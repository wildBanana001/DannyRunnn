import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';
import { config } from '../config.js';
import {
  AccountOrderDeletionBlockedError,
  ActivityCapacityConfigurationChangedError,
  ActivityCapacityExceededError,
  ShopStockConfigurationChangedError,
  ShopStockExceededError,
  anonymizeOrderForAccountDeletion,
  cloneOrder,
  createAnonymizedOrderOpenid,
  hasActivePaymentPreparation,
  hasActiveWechatShippingReport,
  isAccountDeletionBlockingOrder,
  normalizeOrder,
  nowIso,
  sanitizeOrderString,
  shouldRetainOrderAfterAccountDeletion,
  type AccountOrderDeletionResult,
  type ActivityOrderCapacity,
  type FulfillmentReportClaim,
  type OrderKind,
  type OrderRecord,
  type OrderStatus,
  type PaymentPreparationClaim,
  type ShopOrderStockCapacity,
} from './order-model.js';

const ORDERS_TABLE = 'worker_house_orders';
const ACTIVITY_LOCKS_TABLE = 'worker_house_activity_locks';
const ACTIVITIES_TABLE = 'worker_house_activities';
const SHOP_STOCK_LOCKS_TABLE = 'worker_house_shop_stock_locks';
const SHOP_PRODUCTS_TABLE = 'worker_house_shop_products';
const MIGRATIONS_TABLE = 'worker_house_schema_migrations';
const INITIAL_MIGRATION = '001_mysql_order_storage';
const SHOP_STOCK_MIGRATION = '003_mysql_shop_stock_reservations';
const MAX_TRANSACTION_ATTEMPTS = 3;
const MYSQL_READ_RETRY_DELAYS_MS = [50, 150] as const;
const RETRIABLE_MYSQL_READ_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
]);

interface MysqlErrorLike {
  code?: unknown;
  errno?: unknown;
  message?: unknown;
  sqlState?: unknown;
}

interface OrderRow extends RowDataPacket {
  kind: string;
  order_id: string;
  payload: unknown;
  product_id: string;
  status: string;
}

interface CountRow extends RowDataPacket {
  total: number | string;
}

interface MigrationRow extends RowDataPacket {
  version: string;
}

interface ActivityLockRow extends RowDataPacket {
  base_participants: number | string;
  max_participants: number | string;
  updated_at: string;
}

interface ActivityCatalogCapacityRow extends RowDataPacket {
  activity_id: string;
  enabled: number | string;
  payload: unknown;
  updated_at: string;
}

interface ShopStockLockRow extends RowDataPacket {
  stock_limit: number | string | null;
}

interface ShopCatalogStockRow extends RowDataPacket {
  enabled: number | string;
  payload: unknown;
  stock: number | string | null;
}

type QueryExecutor = Pick<Pool, 'execute'> | Pick<PoolConnection, 'execute'>;

const ORDER_SELECT_COLUMNS = 'order_id, kind, product_id, status, payload';

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

const INITIAL_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
    version VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    applied_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE IF NOT EXISTS ${ORDERS_TABLE} (
    order_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    kind VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    client_request_id VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    product_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    openid VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    transaction_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    created_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload JSON NOT NULL,
    PRIMARY KEY (order_id),
    KEY idx_orders_openid_kind_created (openid, kind, created_at),
    KEY idx_orders_product_kind_status (product_id, kind, status),
    KEY idx_orders_kind_created (kind, created_at),
    KEY idx_orders_transaction (transaction_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE IF NOT EXISTS ${ACTIVITY_LOCKS_TABLE} (
    activity_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    base_participants INT UNSIGNED NOT NULL DEFAULT 0,
    max_participants INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (activity_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
  `CREATE TABLE IF NOT EXISTS ${SHOP_STOCK_LOCKS_TABLE} (
    product_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    stock_limit BIGINT UNSIGNED NULL,
    updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
] as const;

export function getMysqlOrderStorageConfigurationIssues() {
  if (config.mysql.url) return [];
  return [
    !config.mysql.host ? 'MYSQL_ADDRESS' : '',
    !config.mysql.username ? 'MYSQL_USERNAME' : '',
    !config.mysql.password ? 'MYSQL_PASSWORD' : '',
    !config.mysql.database ? 'MYSQL_DATABASE' : '',
  ].filter(Boolean);
}

function createMysqlPool() {
  const issues = getMysqlOrderStorageConfigurationIssues();
  if (issues.length > 0) {
    const error = new Error(`MySQL 订单库配置不完整：${issues.join('、')}`) as Error & { code: string };
    error.code = 'MYSQL_CONFIGURATION_REQUIRED';
    throw error;
  }

  const baseOptions = {
    charset: 'utf8mb4',
    connectionLimit: config.mysql.connectionLimit,
    connectTimeout: config.mysql.connectTimeoutMs,
    dateStrings: true,
    decimalNumbers: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    namedPlaceholders: false,
    queueLimit: 0,
    supportBigNumbers: true,
    timezone: 'Z',
    waitForConnections: true,
  } as const;

  if (config.mysql.url) {
    const connectionUrl = new URL(config.mysql.url);
    if (connectionUrl.protocol !== 'mysql:') {
      throw new Error('MYSQL_URL / CONNECTION_URI 必须使用 mysql:// 协议');
    }
    return mysql.createPool({
      ...baseOptions,
      database: decodeURIComponent(connectionUrl.pathname.replace(/^\//, '')),
      host: connectionUrl.hostname,
      password: decodeURIComponent(connectionUrl.password),
      port: connectionUrl.port ? Number(connectionUrl.port) : 3306,
      user: decodeURIComponent(connectionUrl.username),
    });
  }

  return mysql.createPool({
    ...baseOptions,
    database: config.mysql.database,
    host: config.mysql.host,
    password: config.mysql.password,
    port: config.mysql.port,
    user: config.mysql.username,
  });
}

export function getMysqlPool() {
  if (!pool) pool = createMysqlPool();
  return pool;
}

function getMysqlError(error: unknown): MysqlErrorLike {
  return error && typeof error === 'object' ? error as MysqlErrorLike : {};
}

function getMysqlErrorCode(error: unknown) {
  const code = getMysqlError(error).code;
  return typeof code === 'string' ? code : '';
}

export function isRetriableMysqlReadError(error: unknown): boolean {
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    if (RETRIABLE_MYSQL_READ_CODES.has(getMysqlErrorCode(current).toUpperCase())) return true;
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function retryTransientMysqlRead<T>(
  read: () => Promise<T>,
  retryDelaysMs: readonly number[] = MYSQL_READ_RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (!isRetriableMysqlReadError(error) || attempt >= retryDelaysMs.length) throw error;
      const delay = Math.max(0, retryDelaysMs[attempt] || 0);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function runMysqlRead<T>(read: (database: Pool) => Promise<T>) {
  // mysql2 removes a fatally disconnected pooled connection. A fresh acquisition
  // therefore recovers the common CloudRun/MySQL idle-connection reset safely.
  return retryTransientMysqlRead(() => read(getMysqlPool()));
}

function isRetriableTransactionError(error: unknown) {
  return ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(getMysqlErrorCode(error));
}

function isDuplicateEntryError(error: unknown) {
  return getMysqlErrorCode(error) === 'ER_DUP_ENTRY';
}

export function formatMysqlOrderStorageError(error: unknown) {
  const input = getMysqlError(error);
  const code = typeof input.code === 'string' ? input.code : 'MYSQL_ERROR';
  const errno = typeof input.errno === 'number' ? String(input.errno) : '';
  const sqlState = typeof input.sqlState === 'string' ? input.sqlState : '';
  let message = typeof input.message === 'string' ? input.message : String(error || 'unknown');
  message = message
    .replace(/\bmysql:\/\/[^\s"'`]+/gi, 'mysql://[REDACTED_CONNECTION]')
    .replace(/(password\s*[=:]\s*)[^\s,;]+/gi, '$1***');
  if (config.mysql.password) message = message.split(config.mysql.password).join('***');
  return [code, errno, sqlState, message].filter(Boolean).join(' ');
}

async function runTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    const connection = await getMysqlPool().getConnection();
    try {
      await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      lastError = error;
      try {
        await connection.rollback();
      } catch {
        // 原始事务错误优先返回。
      }
      if (!isRetriableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 30));
    } finally {
      connection.release();
    }
  }
  throw lastError;
}

export function decodeMysqlOrderPayload(payload: unknown): OrderRecord {
  let value = payload;
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value === 'string') value = JSON.parse(value) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error('MySQL 订单 payload 格式无效') as Error & { code: string };
    error.code = 'MYSQL_ORDER_PAYLOAD_INVALID';
    throw error;
  }
  return normalizeOrder(value as Partial<OrderRecord>);
}

export function decodeMysqlOrderRow(row: {
  kind: unknown;
  order_id: unknown;
  payload: unknown;
  product_id: unknown;
  status: unknown;
}): OrderRecord {
  const order = decodeMysqlOrderPayload(row.payload);
  if (
    sanitizeOrderString(row.order_id) !== order.id
    || sanitizeOrderString(row.kind) !== order.kind
    || sanitizeOrderString(row.product_id) !== order.productId
    || sanitizeOrderString(row.status) !== order.status
  ) {
    const error = new Error('MySQL 订单 payload 与索引列不一致') as Error & { code: string };
    error.code = 'MYSQL_ORDER_INDEX_MISMATCH';
    throw error;
  }
  return order;
}

export function assertShopStockMigrationApplied(rows: Array<{ version?: unknown }>) {
  if (rows.some((row) => sanitizeOrderString(row.version) === SHOP_STOCK_MIGRATION)) return;
  const error = new Error('MySQL 商城库存迁移 003 尚未应用') as Error & { code: string };
  error.code = 'MYSQL_SCHEMA_MIGRATION_REQUIRED';
  throw error;
}

async function selectOrderById(executor: QueryExecutor, orderId: string, forUpdate = false) {
  const [rows] = await executor.execute<OrderRow[]>(
    `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE}
     WHERE order_id = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [sanitizeOrderString(orderId)],
  );
  return rows[0] ? decodeMysqlOrderRow(rows[0]) : null;
}

async function selectOrders(executor: QueryExecutor, sql: string, parameters: unknown[]) {
  const [rows] = await executor.execute<OrderRow[]>(sql, parameters);
  return rows.map(decodeMysqlOrderRow);
}

function orderIndexValues(order: OrderRecord) {
  return [
    order.id,
    order.kind,
    order.clientRequestId,
    order.productId,
    order.openid,
    order.status,
    order.transactionId,
    order.createdAt,
    order.updatedAt,
    JSON.stringify(order),
  ];
}

async function insertOrder(connection: PoolConnection, order: OrderRecord) {
  await connection.execute<ResultSetHeader>(
    `INSERT INTO ${ORDERS_TABLE} (
      order_id, kind, client_request_id, product_id, openid, status,
      transaction_id, created_at, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    orderIndexValues(order),
  );
}

async function replaceOrder(connection: PoolConnection, order: OrderRecord) {
  await connection.execute<ResultSetHeader>(
    `UPDATE ${ORDERS_TABLE}
     SET kind = ?, client_request_id = ?, product_id = ?, openid = ?, status = ?,
         transaction_id = ?, created_at = ?, updated_at = ?, payload = ?
     WHERE order_id = ?`,
    [
      order.kind,
      order.clientRequestId,
      order.productId,
      order.openid,
      order.status,
      order.transactionId,
      order.createdAt,
      order.updatedAt,
      JSON.stringify(order),
      order.id,
    ],
  );
}

async function ensureActivityLock(
  connection: PoolConnection,
  activityId: string,
  capacity?: ActivityOrderCapacity,
) {
  if (capacity && (
    !Number.isSafeInteger(capacity.currentParticipants)
    || capacity.currentParticipants < 0
    || !Number.isSafeInteger(capacity.maxParticipants)
    || capacity.maxParticipants < 1
    || capacity.currentParticipants > capacity.maxParticipants
    || !sanitizeOrderString(capacity.configurationVersion)
  )) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  const currentParticipants = capacity?.currentParticipants ?? 0;
  const maxParticipants = capacity?.maxParticipants ?? 0;
  const configurationVersion = capacity
    ? sanitizeOrderString(capacity.configurationVersion)
    : '1970-01-01T00:00:00.000Z';
  if (capacity) {
    await connection.execute(
      `INSERT INTO ${ACTIVITY_LOCKS_TABLE}
        (activity_id, base_participants, max_participants, updated_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        base_participants = VALUES(base_participants),
        max_participants = VALUES(max_participants),
        updated_at = VALUES(updated_at)`,
      [activityId, currentParticipants, maxParticipants, configurationVersion],
    );
  } else {
    await connection.execute(
      `INSERT IGNORE INTO ${ACTIVITY_LOCKS_TABLE}
       (activity_id, base_participants, max_participants, updated_at)
       VALUES (?, 0, 0, ?)`,
      [activityId, '1970-01-01T00:00:00.000Z'],
    );
  }
  const [rows] = await connection.execute<ActivityLockRow[]>(
    `SELECT base_participants, max_participants, updated_at
     FROM ${ACTIVITY_LOCKS_TABLE} WHERE activity_id = ? FOR UPDATE`,
    [activityId],
  );
  const locked = {
    currentParticipants: Number(rows[0]?.base_participants),
    maxParticipants: Number(rows[0]?.max_participants),
    configurationVersion: sanitizeOrderString(rows[0]?.updated_at),
  };
  if (capacity && (
    !Number.isSafeInteger(locked.currentParticipants)
    || !Number.isSafeInteger(locked.maxParticipants)
    || locked.currentParticipants !== currentParticipants
    || locked.maxParticipants !== maxParticipants
    || locked.configurationVersion !== configurationVersion
  )) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  return locked;
}

function decodeActivityCatalogPayload(payload: unknown) {
  let value: unknown;
  try {
    value = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    if (typeof value === 'string') value = JSON.parse(value) as unknown;
  } catch {
    throw new ActivityCapacityConfigurationChangedError();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  return value as {
    currentParticipants?: unknown;
    enabled?: unknown;
    id?: unknown;
    maxParticipants?: unknown;
    price?: unknown;
    updatedAt?: unknown;
  };
}

function activityPriceInCents(price: unknown) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  const cents = Math.round(price * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(price * 100 - cents) > 1e-8) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  return cents;
}

async function lockAndResolveCurrentActivityCapacity(
  connection: PoolConnection,
  order: OrderRecord,
  expected: ActivityOrderCapacity,
): Promise<ActivityOrderCapacity> {
  const expectedVersion = sanitizeOrderString(expected.configurationVersion);
  if (
    !Number.isSafeInteger(expected.currentParticipants)
    || expected.currentParticipants < 0
    || !Number.isSafeInteger(expected.maxParticipants)
    || expected.maxParticipants < 1
    || expected.currentParticipants > expected.maxParticipants
    || !expectedVersion
    || order.quantity !== 1
    || order.amount !== order.unitPrice
    || !Number.isSafeInteger(order.unitPrice)
    || order.unitPrice < 0
  ) {
    throw new ActivityCapacityConfigurationChangedError();
  }

  // Lock the authoritative catalog row inside the same transaction as the
  // capacity reservation. This closes the read -> admin update -> order insert
  // window across CloudRun instances.
  const [rows] = await connection.execute<ActivityCatalogCapacityRow[]>(
    `SELECT activity_id, enabled, updated_at, payload
     FROM ${ACTIVITIES_TABLE} WHERE activity_id = ? FOR UPDATE`,
    [order.productId],
  );
  const row = rows[0];
  if (!row) throw new ActivityCapacityConfigurationChangedError();
  const activity = decodeActivityCatalogPayload(row.payload);
  const currentParticipants = activity.currentParticipants;
  const maxParticipants = activity.maxParticipants;
  if (
    String(row.activity_id || '') !== order.productId
    || Number(row.enabled) !== 1
    || activity.id !== order.productId
    || activity.enabled !== true
    || activity.updatedAt !== String(row.updated_at || '')
    || activity.updatedAt !== expectedVersion
    || typeof currentParticipants !== 'number'
    || !Number.isSafeInteger(currentParticipants)
    || currentParticipants < 0
    || typeof maxParticipants !== 'number'
    || !Number.isSafeInteger(maxParticipants)
    || maxParticipants < 1
    || currentParticipants > maxParticipants
    || currentParticipants !== expected.currentParticipants
    || maxParticipants !== expected.maxParticipants
    || activityPriceInCents(activity.price) !== order.unitPrice
  ) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  return { currentParticipants, maxParticipants, configurationVersion: expectedVersion };
}

function decodeShopCatalogProduct(payload: unknown, expectedProductId: string) {
  let value = payload;
  try {
    if (Buffer.isBuffer(value)) value = value.toString('utf8');
    if (typeof value === 'string') value = JSON.parse(value) as unknown;
  } catch {
    throw new ShopStockConfigurationChangedError();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ShopStockConfigurationChangedError();
  }

  const product = value as Record<string, unknown>;
  if (product.id !== expectedProductId || product.enabled !== true) {
    throw new ShopStockConfigurationChangedError();
  }
  return product;
}

function decodeShopCatalogStock(payload: unknown, expectedProductId: string) {
  const product = decodeShopCatalogProduct(payload, expectedProductId);
  if (product.stock === null) return null;
  if (typeof product.stock !== 'number' || !Number.isSafeInteger(product.stock) || product.stock < 0) {
    throw new ShopStockConfigurationChangedError();
  }
  return product.stock;
}

function shopMoneyInCents(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ShopStockConfigurationChangedError();
  }
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 1e-8) {
    throw new ShopStockConfigurationChangedError();
  }
  return cents;
}

// Call only after locking the authoritative catalog row. Compare the immutable
// order snapshot; never silently reprice an existing order during a retry.
export function assertShopOrderMatchesCatalog(order: OrderRecord, payload: unknown) {
  const product = decodeShopCatalogProduct(payload, order.productId);
  const unitPrice = shopMoneyInCents(product.price);
  const shippingFee = shopMoneyInCents(product.shippingFee);
  const minQuantity = product.minQuantity;
  const maxQuantity = product.maxQuantity;
  const fulfillmentType = product.fulfillmentType;
  const fulfillmentLabel = sanitizeOrderString(product.fulfillmentLabel);
  const unitLabel = sanitizeOrderString(product.unitLabel);
  const amount = unitPrice * order.quantity + shippingFee;
  if (
    order.kind !== 'shop'
    || !Number.isInteger(order.quantity)
    || typeof minQuantity !== 'number' || !Number.isInteger(minQuantity) || minQuantity < 1
    || typeof maxQuantity !== 'number' || !Number.isInteger(maxQuantity) || maxQuantity > 99
    || maxQuantity < minQuantity || order.quantity < minQuantity || order.quantity > maxQuantity
    || !Number.isSafeInteger(amount) || amount < 0
    || order.unitPrice !== unitPrice || order.shippingFee !== shippingFee || order.amount !== amount
    || !['delivery', 'pickup', 'onsite'].includes(String(fulfillmentType))
    || fulfillmentType !== order.fulfillmentType
    || !fulfillmentLabel || fulfillmentLabel !== order.fulfillmentLabel
    || !unitLabel || unitLabel !== order.unitLabel
    || (fulfillmentType === 'delivery' ? !order.address : order.address !== null)
  ) {
    throw new ShopStockConfigurationChangedError();
  }
}

function normalizeRequestedStock(stock: number | null) {
  if (stock === null) return null;
  if (!Number.isSafeInteger(stock) || stock < 0) throw new ShopStockConfigurationChangedError();
  return stock;
}

async function lockShopStock(connection: PoolConnection, productId: string) {
  await connection.execute(
    `INSERT IGNORE INTO ${SHOP_STOCK_LOCKS_TABLE} (product_id, stock_limit, updated_at)
     VALUES (?, NULL, ?)`,
    [productId, nowIso()],
  );
  const [rows] = await connection.execute<ShopStockLockRow[]>(
    `SELECT stock_limit FROM ${SHOP_STOCK_LOCKS_TABLE} WHERE product_id = ? FOR UPDATE`,
    [productId],
  );
  if (!rows[0]) throw new ShopStockConfigurationChangedError();
}

async function resolveCurrentShopStock(
  connection: PoolConnection,
  productId: string,
  requestedCapacity?: ShopOrderStockCapacity,
  expectedOrder?: OrderRecord,
) {
  const [rows] = await connection.execute<ShopCatalogStockRow[]>(
    `SELECT enabled, stock, payload FROM ${SHOP_PRODUCTS_TABLE} WHERE product_id = ? LIMIT 1 FOR UPDATE`,
    [productId],
  );
  const row = rows[0];
  if (!row || Number(row.enabled) !== 1) throw new ShopStockConfigurationChangedError();
  if (expectedOrder) assertShopOrderMatchesCatalog(expectedOrder, row.payload);

  const payloadStock = decodeShopCatalogStock(row.payload, productId);
  const indexedStock = row.stock === null ? null : Number(row.stock);
  if (
    (indexedStock !== null && (!Number.isSafeInteger(indexedStock) || indexedStock < 0))
    || indexedStock !== payloadStock
    || (requestedCapacity !== undefined
      && normalizeRequestedStock(requestedCapacity.stock) !== payloadStock)
  ) {
    throw new ShopStockConfigurationChangedError();
  }
  if (expectedOrder && requestedCapacity === undefined && payloadStock !== null && expectedOrder.quantity > payloadStock) {
    throw new ShopStockConfigurationChangedError();
  }

  await connection.execute(
    `UPDATE ${SHOP_STOCK_LOCKS_TABLE} SET stock_limit = ?, updated_at = ? WHERE product_id = ?`,
    [payloadStock, nowIso(), productId],
  );
  return payloadStock;
}

async function applyInitialSchema() {
  const database = getMysqlPool();
  for (const statement of INITIAL_SCHEMA_STATEMENTS) {
    await database.query(statement);
  }
  await database.execute(
    `INSERT IGNORE INTO ${MIGRATIONS_TABLE} (version, applied_at) VALUES (?, ?)`,
    [INITIAL_MIGRATION, nowIso()],
  );
  await database.execute(
    `INSERT IGNORE INTO ${MIGRATIONS_TABLE} (version, applied_at) VALUES (?, ?)`,
    [SHOP_STOCK_MIGRATION, nowIso()],
  );
}

async function verifySchema() {
  const database = getMysqlPool();
  await database.query('SELECT 1');
  await database.query(`SELECT order_id FROM ${ORDERS_TABLE} LIMIT 0`);
  await database.query(`SELECT activity_id FROM ${ACTIVITY_LOCKS_TABLE} LIMIT 0`);
  await database.query(
    `SELECT product_id, stock_limit, updated_at FROM ${SHOP_STOCK_LOCKS_TABLE} LIMIT 0`,
  );
  const [migrationRows] = await database.execute<MigrationRow[]>(
    `SELECT version FROM ${MIGRATIONS_TABLE} WHERE version = ? LIMIT 1`,
    [SHOP_STOCK_MIGRATION],
  );
  assertShopStockMigrationApplied(migrationRows);
}

async function ensureSchemaReady() {
  if (!schemaReady) {
    schemaReady = retryTransientMysqlRead(
      () => config.mysql.autoMigrate ? applyInitialSchema() : verifySchema(),
    )
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

export async function migrateMysqlOrderStorage() {
  await applyInitialSchema();
  schemaReady = Promise.resolve();
}

export async function closeMysqlOrderStorage() {
  schemaReady = null;
  if (!pool) return;
  const activePool = pool;
  pool = null;
  await activePool.end();
}

export async function checkMysqlOrderStorageReady() {
  const issues = getMysqlOrderStorageConfigurationIssues();
  if (issues.length > 0) {
    console.error(`[orders store] mysql configuration_required issues=${issues.join(',')}`);
    return false;
  }
  try {
    await ensureSchemaReady();
    return true;
  } catch (error) {
    console.error(`[orders store] mysql readiness error ${formatMysqlOrderStorageError(error)}`);
    return false;
  }
}

export async function createMysqlOrder(record: OrderRecord) {
  const error = new Error(
    record.kind === 'activity'
      ? '活动订单必须通过名额事务创建'
      : '商城订单必须通过库存事务创建',
  ) as Error & { code: string };
  error.code = record.kind === 'activity'
    ? 'ACTIVITY_CAPACITY_TRANSACTION_REQUIRED'
    : 'SHOP_STOCK_TRANSACTION_REQUIRED';
  throw error;
}

export async function createMysqlShopOrderWithStock(
  record: OrderRecord,
  capacity: ShopOrderStockCapacity,
) {
  await ensureSchemaReady();
  try {
    return await runTransaction(async (connection) => {
      await lockShopStock(connection, record.productId);

      // Check idempotency only after acquiring the product mutex. Concurrent
      // retries then observe the winning insert and never consume stock twice.
      const duplicate = await selectOrderById(connection, record.id, true);
      if (duplicate) return cloneOrder(duplicate);

      const stock = await resolveCurrentShopStock(connection, record.productId, capacity, record);
      if (stock !== null) {
        const reservations = await selectOrders(
          connection,
          `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE}
           WHERE product_id = ? AND kind = 'shop' AND status IN ('pending', 'paid')`,
          [record.productId],
        );
        const reservedQuantity = reservations.reduce((total, order) => total + order.quantity, 0);
        if (!Number.isSafeInteger(reservedQuantity) || reservedQuantity + record.quantity > stock) {
          throw new ShopStockExceededError();
        }
      }

      await insertOrder(connection, record);
      return cloneOrder(record);
    });
  } catch (error) {
    if (!isDuplicateEntryError(error)) throw error;
    const existing = await runMysqlRead((database) => selectOrderById(database, record.id));
    if (existing) return cloneOrder(existing);
    throw error;
  }
}

export async function createMysqlActivityOrderWithCapacity(
  record: OrderRecord,
  capacity: ActivityOrderCapacity,
) {
  await ensureSchemaReady();
  try {
    return await runTransaction(async (connection) => {
      const catalogCapacity = await lockAndResolveCurrentActivityCapacity(connection, record, capacity);
      const lockedCapacity = await ensureActivityLock(connection, record.productId, catalogCapacity);

      const duplicate = await selectOrderById(connection, record.id, true);
      if (duplicate) return cloneOrder(duplicate);

      const existingOrders = await selectOrders(
        connection,
        `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE}
         WHERE product_id = ? AND kind = 'activity' AND openid = ?
           AND status IN ('pending', 'paid')
         ORDER BY (status = 'paid') DESC, created_at ASC
         LIMIT 1`,
        [record.productId, record.openid],
      );
      if (existingOrders[0]) return cloneOrder(existingOrders[0]);

      const [countRows] = await connection.execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM ${ORDERS_TABLE}
         WHERE product_id = ? AND kind = 'activity' AND status IN ('pending', 'paid')`,
        [record.productId],
      );
      const activeReservations = Number(countRows[0]?.total || 0);
      const { currentParticipants, maxParticipants } = lockedCapacity;
      if (maxParticipants > 0 && currentParticipants + activeReservations + 1 > maxParticipants) {
        throw new ActivityCapacityExceededError();
      }

      await insertOrder(connection, record);
      return cloneOrder(record);
    });
  } catch (error) {
    if (!isDuplicateEntryError(error)) throw error;
    const existing = await runMysqlRead((database) => selectOrderById(database, record.id));
    if (existing) return cloneOrder(existing);
    throw error;
  }
}

export async function getMysqlOrderById(orderId: string) {
  await ensureSchemaReady();
  const order = await runMysqlRead((database) => selectOrderById(database, orderId));
  return order ? cloneOrder(order) : null;
}

export async function getMysqlOrdersByOpenid(openid: string, kind?: OrderKind) {
  await ensureSchemaReady();
  const parameters: unknown[] = [openid];
  const kindClause = kind ? ' AND kind = ?' : '';
  if (kind) parameters.push(kind);
  return cloneOrder(await runMysqlRead((database) => selectOrders(
    database,
    `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE}
     WHERE openid = ?${kindClause}
     ORDER BY created_at DESC`,
    parameters,
  )));
}

export async function getMysqlOrdersByProductId(productId: string, kind?: OrderKind) {
  await ensureSchemaReady();
  const parameters: unknown[] = [productId];
  const kindClause = kind ? ' AND kind = ?' : '';
  if (kind) parameters.push(kind);
  return cloneOrder(await runMysqlRead((database) => selectOrders(
    database,
    `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE} WHERE product_id = ?${kindClause}`,
    parameters,
  )));
}

export async function getMysqlOrdersByKind(kind: OrderKind) {
  await ensureSchemaReady();
  return cloneOrder(await runMysqlRead((database) => selectOrders(
    database,
    `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE}
     WHERE kind = ? ORDER BY created_at DESC`,
    [kind],
  )));
}

export async function getMysqlActiveShopOrdersByProductIds(productIds: string[]) {
  await ensureSchemaReady();
  const normalizedProductIds = Array.from(new Set(
    productIds.map((productId) => sanitizeOrderString(productId)).filter(Boolean),
  ));
  if (normalizedProductIds.length === 0) return [];
  const placeholders = normalizedProductIds.map(() => '?').join(', ');
  return cloneOrder(await runMysqlRead((database) => selectOrders(
    database,
    `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE}
     WHERE kind = 'shop' AND status IN ('pending', 'paid')
       AND product_id IN (${placeholders})`,
    normalizedProductIds,
  )));
}

export async function deleteOrAnonymizeMysqlOrdersByOpenid(
  openid: string,
): Promise<AccountOrderDeletionResult> {
  await ensureSchemaReady();
  const normalizedOpenid = sanitizeOrderString(openid);
  if (!normalizedOpenid) return { anonymized: 0, deleted: 0 };

  return runTransaction(async (connection) => {
    const orders = await selectOrders(
      connection,
      `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE} WHERE openid = ? FOR UPDATE`,
      [normalizedOpenid],
    );
    const blockers = orders.filter(isAccountDeletionBlockingOrder);
    if (blockers.length > 0) {
      throw new AccountOrderDeletionBlockedError(blockers);
    }

    const result: AccountOrderDeletionResult = { anonymized: 0, deleted: 0 };
    for (const order of orders) {
      if (shouldRetainOrderAfterAccountDeletion(order)) {
        const anonymized = anonymizeOrderForAccountDeletion(
          order,
          createAnonymizedOrderOpenid(),
        );
        await replaceOrder(connection, anonymized);
        result.anonymized += 1;
      } else {
        await connection.execute<ResultSetHeader>(
          `DELETE FROM ${ORDERS_TABLE} WHERE order_id = ?`,
          [order.id],
        );
        result.deleted += 1;
      }
    }
    return result;
  });
}

export async function claimMysqlOrderPaymentPreparation(
  orderId: string,
  token: string,
  leaseMilliseconds: number,
): Promise<PaymentPreparationClaim> {
  await ensureSchemaReady();
  const preparingUntil = new Date(Date.now() + Math.max(1_000, leaseMilliseconds)).toISOString();
  const snapshot = await runMysqlRead((database) => selectOrderById(database, orderId));
  if (!snapshot) return { claimed: false, order: null };
  return runTransaction(async (connection) => {
    // Use the same mutex -> order -> catalog lock order as shop creation and
    // status transitions, including retries that already have a prepay_id.
    if (snapshot.kind === 'shop') await lockShopStock(connection, snapshot.productId);
    const current = await selectOrderById(connection, orderId, true);
    if (!current) return { claimed: false, order: null };
    if (current.kind !== snapshot.kind || current.productId !== snapshot.productId) {
      throw new Error('订单不可变字段发生冲突');
    }
    if (current.kind === 'shop' && current.status === 'pending') {
      await resolveCurrentShopStock(connection, current.productId, undefined, current);
    }
    if (current.status !== 'pending' || current.prepayId || hasActivePaymentPreparation(current)) {
      return { claimed: false, order: cloneOrder(current) };
    }

    const updated = normalizeOrder({
      ...current,
      paymentPreparationToken: sanitizeOrderString(token),
      paymentPreparingUntil: preparingUntil,
      updatedAt: nowIso(),
    });
    await replaceOrder(connection, updated);
    return { claimed: true, order: cloneOrder(updated) };
  });
}

export async function finishMysqlOrderPaymentPreparation(
  orderId: string,
  token: string,
  input: Pick<OrderRecord, 'prepayId' | 'failureReason'>,
) {
  await ensureSchemaReady();
  return runTransaction(async (connection) => {
    const current = await selectOrderById(connection, orderId, true);
    if (!current) return null;
    if (current.prepayId || current.status !== 'pending') return cloneOrder(current);
    if (current.paymentPreparationToken !== sanitizeOrderString(token)) return cloneOrder(current);

    const updated = normalizeOrder({
      ...current,
      prepayId: sanitizeOrderString(input.prepayId),
      failureReason: sanitizeOrderString(input.failureReason),
      paymentPreparationToken: '',
      paymentPreparingUntil: '',
      updatedAt: nowIso(),
    });
    await replaceOrder(connection, updated);
    return cloneOrder(updated);
  });
}

export async function claimMysqlOrderFulfillmentReport(
  orderId: string,
  fulfilledBy: string,
  token: string,
  leaseMilliseconds: number,
): Promise<FulfillmentReportClaim> {
  await ensureSchemaReady();
  return runTransaction(async (connection) => {
    const current = await selectOrderById(connection, orderId, true);
    if (!current) return { claimed: false, order: null, reportRequired: false };

    const reportRequired = current.status === 'paid'
      && !current.mock
      && current.amount > 0;
    const fulfillmentPatch = {
      fulfillmentStatus: 'fulfilled' as const,
      fulfilledAt: current.fulfilledAt || nowIso(),
      fulfilledBy: current.fulfilledBy || sanitizeOrderString(fulfilledBy),
    };

    if (!reportRequired) {
      const updated = normalizeOrder({
        ...current,
        ...fulfillmentPatch,
        wechatShippingStatus: 'not_required',
        updatedAt: nowIso(),
      });
      await replaceOrder(connection, updated);
      return { claimed: false, order: cloneOrder(updated), reportRequired: false };
    }

    if (current.wechatShippingStatus === 'reported' || hasActiveWechatShippingReport(current)) {
      if (current.fulfillmentStatus === 'fulfilled') {
        return { claimed: false, order: cloneOrder(current), reportRequired: true };
      }
      const updated = normalizeOrder({ ...current, ...fulfillmentPatch, updatedAt: nowIso() });
      await replaceOrder(connection, updated);
      return { claimed: false, order: cloneOrder(updated), reportRequired: true };
    }

    const updated = normalizeOrder({
      ...current,
      ...fulfillmentPatch,
      wechatShippingStatus: 'reporting',
      wechatShippingError: '',
      wechatShippingAttempts: current.wechatShippingAttempts + 1,
      wechatShippingReportToken: sanitizeOrderString(token),
      wechatShippingReportingUntil: new Date(Date.now() + Math.max(1_000, leaseMilliseconds)).toISOString(),
      updatedAt: nowIso(),
    });
    await replaceOrder(connection, updated);
    return { claimed: true, order: cloneOrder(updated), reportRequired: true };
  });
}

export async function finishMysqlOrderFulfillmentReport(
  orderId: string,
  token: string,
  input: { success: boolean; error?: string },
) {
  await ensureSchemaReady();
  return runTransaction(async (connection) => {
    const current = await selectOrderById(connection, orderId, true);
    if (!current) return null;
    if (current.wechatShippingStatus === 'reported') return cloneOrder(current);
    if (current.wechatShippingReportToken !== sanitizeOrderString(token)) return cloneOrder(current);

    const updated = normalizeOrder({
      ...current,
      wechatShippingStatus: input.success ? 'reported' : 'failed',
      wechatShippingReportedAt: input.success ? (current.wechatShippingReportedAt || nowIso()) : '',
      wechatShippingError: input.success ? '' : sanitizeOrderString(input.error, '微信履约上报失败'),
      wechatShippingReportToken: '',
      wechatShippingReportingUntil: '',
      updatedAt: nowIso(),
    });
    await replaceOrder(connection, updated);
    return cloneOrder(updated);
  });
}

async function updateLockedOrderStatus(
  connection: PoolConnection,
  current: OrderRecord,
  status: OrderStatus,
  options: {
    transactionId?: string;
    failureReason?: string;
    notifyId?: string;
    paidAt?: string;
  },
) {
  if (current.status === 'paid' && status !== 'paid') return cloneOrder(current);
  if ((current.status === 'closed' || current.status === 'failed') && status === 'pending') {
    const error = new Error('终态订单不能恢复为待支付') as Error & { code: string };
    error.code = 'ORDER_STATUS_TRANSITION_INVALID';
    throw error;
  }
  if (
    current.status === 'paid'
    && status === 'paid'
    && current.transactionId
    && options.transactionId
    && current.transactionId !== options.transactionId
  ) {
    const error = new Error('已支付订单的微信支付流水号不一致') as Error & { code: string };
    error.code = 'PAYMENT_TRANSACTION_CONFLICT';
    throw error;
  }

  const updatedAt = nowIso();
  const shouldQueueWechatShipping = status === 'paid'
    && !current.mock
    && current.amount > 0
    && current.wechatShippingStatus === 'not_required';
  const next = normalizeOrder({
    ...current,
    status,
    transactionId: options.transactionId || current.transactionId,
    paidAt: status === 'paid' ? (options.paidAt || current.paidAt || updatedAt) : current.paidAt,
    failureReason: options.failureReason ?? current.failureReason,
    lastNotifyId: options.notifyId || current.lastNotifyId,
    paymentPreparationToken: status === 'pending' ? current.paymentPreparationToken : '',
    paymentPreparingUntil: status === 'pending' ? current.paymentPreparingUntil : '',
    wechatShippingStatus: shouldQueueWechatShipping ? 'pending' : current.wechatShippingStatus,
    updatedAt,
  });
  await replaceOrder(connection, next);
  return cloneOrder(next);
}

export async function updateMysqlOrderStatus(
  orderId: string,
  status: OrderStatus,
  options: {
    transactionId?: string;
    failureReason?: string;
    notifyId?: string;
    paidAt?: string;
    activityCapacity?: ActivityOrderCapacity;
  } = {},
) {
  await ensureSchemaReady();
  const snapshot = await runMysqlRead((database) => selectOrderById(database, orderId));
  if (!snapshot) return null;

  return runTransaction(async (connection) => {
    let lockedActivityCapacity: Awaited<ReturnType<typeof ensureActivityLock>> | null = null;
    if (snapshot.kind === 'activity') {
      const reactivating = status === 'paid'
        && snapshot.status !== 'pending'
        && snapshot.status !== 'paid';
      if (reactivating && !options.activityCapacity) {
        throw new ActivityCapacityConfigurationChangedError();
      }
      const catalogCapacity = reactivating && options.activityCapacity
        ? await lockAndResolveCurrentActivityCapacity(connection, snapshot, options.activityCapacity)
        : undefined;
      lockedActivityCapacity = await ensureActivityLock(
        connection,
        snapshot.productId,
        catalogCapacity,
      );
    } else {
      // Shop creation takes this mutex before inspecting active reservations. Status
      // changes use the same lock order so releasing a reservation and admitting a
      // replacement are atomic across CloudRun instances.
      await lockShopStock(connection, snapshot.productId);
    }
    const current = await selectOrderById(connection, orderId, true);
    if (!current) return null;
    if (current.kind !== snapshot.kind || current.productId !== snapshot.productId) {
      throw new Error('订单不可变字段发生冲突');
    }

    if (
      current.kind === 'shop'
      && status === 'paid'
      && current.status !== 'pending'
      && current.status !== 'paid'
    ) {
      // A late SUCCESS callback after a terminal status would re-acquire stock.
      // Validate it under the product mutex; when a replacement already consumed
      // the released capacity, fail closed instead of silently overselling.
      const stock = await resolveCurrentShopStock(connection, current.productId);
      if (stock !== null) {
        const reservations = await selectOrders(
          connection,
          `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE}
           WHERE product_id = ? AND kind = 'shop' AND status IN ('pending', 'paid')`,
          [current.productId],
        );
        const reservedQuantity = reservations.reduce((total, order) => total + order.quantity, 0);
        if (!Number.isSafeInteger(reservedQuantity) || reservedQuantity + current.quantity > stock) {
          throw new ShopStockExceededError();
        }
      }
    }
    if (
      current.kind === 'activity'
      && status === 'paid'
      && current.status !== 'pending'
      && current.status !== 'paid'
    ) {
      if (!options.activityCapacity || !lockedActivityCapacity) {
        throw new ActivityCapacityConfigurationChangedError();
      }
      const reservations = await selectOrders(
        connection,
        `SELECT ${ORDER_SELECT_COLUMNS} FROM ${ORDERS_TABLE}
         WHERE product_id = ? AND kind = 'activity' AND status IN ('pending', 'paid')`,
        [current.productId],
      );
      const { currentParticipants, maxParticipants } = lockedActivityCapacity;
      if (
        reservations.some((order) => order.openid === current.openid)
        || (maxParticipants > 0 && currentParticipants + reservations.length + 1 > maxParticipants)
      ) {
        throw new ActivityCapacityExceededError();
      }
    }
    return updateLockedOrderStatus(connection, current, status, options);
  });
}
