import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { config } from '../config.js';
import type { ActivityRecord } from '../types/index.js';
import type { ShopProduct } from './shop.js';
import { getMysqlPool, retryTransientMysqlRead } from './mysql-orders.js';

const ACTIVITIES_TABLE = 'worker_house_activities';
const PRODUCTS_TABLE = 'worker_house_shop_products';
const CATALOG_STATE_TABLE = 'worker_house_catalog_state';
const MIGRATIONS_TABLE = 'worker_house_schema_migrations';
const CATALOG_MIGRATION = '002_mysql_catalog_storage';
const INITIAL_SEED_VERSION = 1;

interface PayloadRow extends RowDataPacket {
  payload: unknown;
}

interface ActivityPayloadRow extends PayloadRow {
  activity_id: string;
  enabled: number | string;
  sort_order: number | string;
  start_date: string;
  updated_at: string;
}

interface ProductPayloadRow extends PayloadRow {
  category: string;
  enabled: number | string;
  product_id: string;
  stock: number | string | null;
}

interface CatalogStateRow extends RowDataPacket {
  seed_version: number | string;
}

const CATALOG_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
    version VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    applied_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE IF NOT EXISTS ${ACTIVITIES_TABLE} (
    activity_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    start_date VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload JSON NOT NULL,
    PRIMARY KEY (activity_id),
    KEY idx_activities_enabled_start (enabled, start_date),
    KEY idx_activities_sort (sort_order, activity_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE IF NOT EXISTS ${PRODUCTS_TABLE} (
    product_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    category VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    stock INT UNSIGNED NULL,
    updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload JSON NOT NULL,
    PRIMARY KEY (product_id),
    KEY idx_products_enabled_sort (enabled, sort_order, product_id),
    KEY idx_products_category_sort (category, sort_order, product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE IF NOT EXISTS ${CATALOG_STATE_TABLE} (
    catalog_name VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    seed_version INT UNSIGNED NOT NULL DEFAULT 0,
    seeded_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    PRIMARY KEY (catalog_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
] as const;

let schemaReady: Promise<void> | null = null;

function nowIso() {
  return new Date().toISOString();
}

export function decodeMysqlCatalogPayload<T>(payload: unknown, catalogName = 'catalog'): T {
  let value = payload;
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value === 'string') value = JSON.parse(value) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error(`MySQL ${catalogName} payload 格式无效`) as Error & { code: string };
    error.code = 'MYSQL_CATALOG_PAYLOAD_INVALID';
    throw error;
  }
  return structuredClone(value as T);
}

function invalidCatalogPayload(message: string): never {
  const error = new Error(message) as Error & { code: string };
  error.code = 'MYSQL_CATALOG_PAYLOAD_INVALID';
  throw error;
}

export function decodeMysqlProductRow(row: ProductPayloadRow): ShopProduct {
  const product = decodeMysqlCatalogPayload<ShopProduct>(row.payload, 'shop product');
  const rowProductId = String(row.product_id || '').trim();
  const payloadProductId = typeof product.id === 'string' ? product.id.trim() : '';
  if (!rowProductId || payloadProductId !== rowProductId) {
    invalidCatalogPayload('MySQL shop product payload id 与索引列不一致');
  }
  if (typeof product.enabled !== 'boolean' || Number(row.enabled) !== (product.enabled ? 1 : 0)) {
    invalidCatalogPayload('MySQL shop product payload enabled 与索引列不一致');
  }
  const rowCategory = String(row.category || '').trim();
  const payloadCategory = typeof product.category === 'string' ? product.category.trim() : '';
  if (payloadCategory !== rowCategory) {
    invalidCatalogPayload('MySQL shop product payload category 与索引列不一致');
  }

  const rowStock = row.stock === null ? null : Number(row.stock);
  const payloadStock = product.stock === null ? null : Number(product.stock);
  if (
    (rowStock !== null && (!Number.isSafeInteger(rowStock) || rowStock < 0))
    || (payloadStock !== null && (!Number.isSafeInteger(payloadStock) || payloadStock < 0))
    || rowStock !== payloadStock
  ) {
    invalidCatalogPayload('MySQL shop product payload stock 与索引列不一致');
  }
  return product;
}

export function decodeMysqlActivityRow(row: ActivityPayloadRow): ActivityRecord {
  const activity = decodeMysqlCatalogPayload<ActivityRecord>(row.payload, 'activity');
  const rowActivityId = String(row.activity_id || '').trim();
  const payloadActivityId = typeof activity.id === 'string' ? activity.id.trim() : '';
  if (!rowActivityId || payloadActivityId !== rowActivityId) {
    invalidCatalogPayload('MySQL activity payload id 与索引列不一致');
  }
  if (typeof activity.enabled !== 'boolean' || Number(row.enabled) !== (activity.enabled ? 1 : 0)) {
    invalidCatalogPayload('MySQL activity payload enabled 与索引列不一致');
  }
  if (String(row.start_date || '') !== activity.startDate) {
    invalidCatalogPayload('MySQL activity payload startDate 与索引列不一致');
  }
  if (String(row.updated_at || '') !== activity.updatedAt) {
    invalidCatalogPayload('MySQL activity payload updatedAt 与索引列不一致');
  }
  const rowSort = Number(row.sort_order);
  const payloadSort = activity.sort ?? 0;
  if (!Number.isSafeInteger(rowSort) || rowSort < 0 || rowSort !== payloadSort) {
    invalidCatalogPayload('MySQL activity payload sort 与索引列不一致');
  }
  return activity;
}

async function applyCatalogSchema() {
  const database = getMysqlPool();
  for (const statement of CATALOG_SCHEMA_STATEMENTS) {
    await database.query(statement);
  }
  await database.execute(
    `INSERT IGNORE INTO ${MIGRATIONS_TABLE} (version, applied_at) VALUES (?, ?)`,
    [CATALOG_MIGRATION, nowIso()],
  );
}

async function verifyCatalogSchema() {
  const database = getMysqlPool();
  await database.query(`SELECT activity_id FROM ${ACTIVITIES_TABLE} LIMIT 0`);
  await database.query(`SELECT product_id FROM ${PRODUCTS_TABLE} LIMIT 0`);
  await database.query(`SELECT catalog_name FROM ${CATALOG_STATE_TABLE} LIMIT 0`);
}

async function ensureCatalogSchemaReady() {
  if (!schemaReady) {
    schemaReady = retryTransientMysqlRead(
      () => config.mysql.autoMigrate ? applyCatalogSchema() : verifyCatalogSchema(),
    ).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function withTransaction<T>(work: (connection: PoolConnection) => Promise<T>) {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Preserve the original catalog error.
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function seedCatalog(
  catalogName: 'activities' | 'products',
  seed: (connection: PoolConnection) => Promise<void>,
) {
  await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT IGNORE INTO ${CATALOG_STATE_TABLE} (catalog_name, seed_version, seeded_at)
       VALUES (?, 0, '')`,
      [catalogName],
    );
    const [rows] = await connection.execute<CatalogStateRow[]>(
      `SELECT seed_version FROM ${CATALOG_STATE_TABLE} WHERE catalog_name = ? FOR UPDATE`,
      [catalogName],
    );
    if (Number(rows[0]?.seed_version || 0) >= INITIAL_SEED_VERSION) return;

    await seed(connection);
    await connection.execute(
      `UPDATE ${CATALOG_STATE_TABLE} SET seed_version = ?, seeded_at = ? WHERE catalog_name = ?`,
      [INITIAL_SEED_VERSION, nowIso(), catalogName],
    );
  });
}

function activityValues(activity: ActivityRecord) {
  return [
    activity.id,
    activity.enabled === true ? 1 : 0,
    Math.trunc(Number(activity.sort) || 0),
    activity.startDate || '',
    activity.updatedAt || activity.createdAt || nowIso(),
    JSON.stringify(activity),
  ];
}

async function writeActivity(connection: PoolConnection, activity: ActivityRecord) {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO ${ACTIVITIES_TABLE}
      (activity_id, enabled, sort_order, start_date, updated_at, payload)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled), sort_order = VALUES(sort_order),
      start_date = VALUES(start_date), updated_at = VALUES(updated_at), payload = VALUES(payload)`,
    activityValues(activity),
  );
}

function productValues(product: ShopProduct, sortOrder: number) {
  return [
    product.id,
    product.enabled ? 1 : 0,
    product.category,
    sortOrder,
    product.stock,
    nowIso(),
    JSON.stringify(product),
  ];
}

async function writeProduct(connection: PoolConnection, product: ShopProduct, sortOrder: number) {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO ${PRODUCTS_TABLE}
      (product_id, enabled, category, sort_order, stock, updated_at, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      enabled = VALUES(enabled), category = VALUES(category), sort_order = VALUES(sort_order),
      stock = VALUES(stock), updated_at = VALUES(updated_at), payload = VALUES(payload)`,
    productValues(product, sortOrder),
  );
}

export async function migrateMysqlCatalogStorage() {
  await applyCatalogSchema();
  schemaReady = Promise.resolve();
}

export async function initializeMysqlActivityCatalog(seedActivities: ActivityRecord[]) {
  await ensureCatalogSchemaReady();
  await seedCatalog('activities', async (connection) => {
    for (const activity of seedActivities) await writeActivity(connection, activity);
  });
  return listMysqlActivities();
}

export async function initializeMysqlProductCatalog(seedProducts: ShopProduct[]) {
  await ensureCatalogSchemaReady();
  await seedCatalog('products', async (connection) => {
    for (const [index, product] of seedProducts.entries()) {
      await writeProduct(connection, product, index);
    }
  });
  return listMysqlProducts();
}

export async function listMysqlActivities() {
  await ensureCatalogSchemaReady();
  const [rows] = await retryTransientMysqlRead(() => getMysqlPool().execute<ActivityPayloadRow[]>(
    `SELECT activity_id, enabled, sort_order, start_date, updated_at, payload FROM ${ACTIVITIES_TABLE}
     ORDER BY start_date DESC, sort_order ASC, activity_id ASC`,
  ));
  return rows.map(decodeMysqlActivityRow);
}

export async function getMysqlActivityById(activityId: string) {
  await ensureCatalogSchemaReady();
  const [rows] = await retryTransientMysqlRead(() => getMysqlPool().execute<ActivityPayloadRow[]>(
    `SELECT activity_id, enabled, sort_order, start_date, updated_at, payload
     FROM ${ACTIVITIES_TABLE} WHERE activity_id = ? LIMIT 1`,
    [activityId],
  ));
  return rows[0] ? decodeMysqlActivityRow(rows[0]) : null;
}

export async function upsertMysqlActivity(activity: ActivityRecord) {
  await ensureCatalogSchemaReady();
  await withTransaction((connection) => writeActivity(connection, activity));
  return structuredClone(activity);
}

export async function deleteMysqlActivity(activityId: string) {
  await ensureCatalogSchemaReady();
  const [result] = await getMysqlPool().execute<ResultSetHeader>(
    `DELETE FROM ${ACTIVITIES_TABLE} WHERE activity_id = ?`,
    [activityId],
  );
  return result.affectedRows > 0;
}

export async function listMysqlProducts() {
  await ensureCatalogSchemaReady();
  const [rows] = await retryTransientMysqlRead(() => getMysqlPool().execute<ProductPayloadRow[]>(
    `SELECT product_id, enabled, category, stock, payload
     FROM ${PRODUCTS_TABLE} ORDER BY sort_order ASC, product_id ASC`,
  ));
  return rows.map(decodeMysqlProductRow);
}

export async function getMysqlProductById(productId: string) {
  await ensureCatalogSchemaReady();
  const [rows] = await retryTransientMysqlRead(() => getMysqlPool().execute<ProductPayloadRow[]>(
    `SELECT product_id, enabled, category, stock, payload
     FROM ${PRODUCTS_TABLE} WHERE product_id = ? LIMIT 1`,
    [productId],
  ));
  return rows[0] ? decodeMysqlProductRow(rows[0]) : null;
}
