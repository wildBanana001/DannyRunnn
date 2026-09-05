import { createHash, randomUUID } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogs = {
  activities: { table: 'worker_house_activities', key: 'activity_id', columns: 'enabled, sort_order, start_date, updated_at, payload' },
  products: { table: 'worker_house_shop_products', key: 'product_id', columns: 'enabled, category, sort_order, stock, updated_at, payload' },
};
const snapshotKind = 'worker-house-one-cent-prices-v1';
class PriceToolError extends Error {}
function requireValue(condition, message) { if (!condition) throw new PriceToolError(message); }
function validMoney(value) {
  return typeof value === 'number' && value >= 0 && Number.isFinite(value)
    && Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}
function validVersion(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function parseIds(value) {
  const ids = typeof value === 'string' ? value.split(',') : [];
  requireValue(ids.length > 0 && ids.length <= 100
    && ids.every((id) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id) && !/^(all|any)$/i.test(id))
    && new Set(ids).size === ids.length, 'Provide 1–100 unique, exact IDs; empty IDs, all, and wildcards are forbidden.');
  return ids.sort();
}

export function parsePriceArguments(args) {
  const options = {};
  for (const arg of args) {
    const match = /^--(catalog|ids|snapshot|restore)=(.+)$/.exec(arg);
    const name = arg === '--apply' ? 'apply' : arg === '--confirm-sales-paused' ? 'confirmSalesPaused' : match?.[1];
    requireValue(name && !Object.hasOwn(options, name), 'Unknown, empty, or duplicate argument. Use --catalog=activities|products --ids=id1,id2 [--apply --confirm-sales-paused --snapshot=/absolute/new.json] or [--restore=/absolute/snapshot.json --apply --confirm-sales-paused].');
    options[name] = name === 'apply' || name === 'confirmSalesPaused' ? true : match[2];
  }
  requireValue(Object.hasOwn(catalogs, options.catalog ?? ''), 'Explicit --catalog=activities or --catalog=products is required.');
  options.ids = parseIds(options.ids);
  for (const name of ['snapshot', 'restore']) {
    if (options[name]) requireValue(isAbsolute(options[name]), 'Snapshot and restore paths must be explicit absolute paths.');
  }
  requireValue(!(options.snapshot && options.restore), 'Use --snapshot for test pricing or --restore for restoration, never both.');
  requireValue(!options.apply || options.restore || options.snapshot, '--apply requires --snapshot=/absolute/new.json before any price update.');
  requireValue(!options.apply || options.confirmSalesPaused, '--apply requires --confirm-sales-paused after pausing new sales and draining in-flight order creation; local environment variables are not proof.');
  return { ...options, apply: options.apply === true };
}

export function readPriceConnection(env) {
  let host, port, user, password, database;
  try {
    if (env.MYSQL_URL?.trim()) {
      const url = new URL(env.MYSQL_URL.trim());
      requireValue(url.protocol === 'mysql:' && !url.search && !url.hash, 'MYSQL_URL must be a mysql: URL without query or fragment.');
      host = url.hostname.replace(/^\[|\]$/g, '');
      port = Number(url.port || 3306);
      user = decodeURIComponent(url.username);
      password = decodeURIComponent(url.password);
      database = decodeURIComponent(url.pathname.slice(1));
    } else {
      const address = env.MYSQL_ADDRESS?.trim() || '';
      const match = /^(?:\[([^\]]+)\]|([^:\s]+))(?::(\d+))?$/.exec(address);
      requireValue(match, 'Set explicit MYSQL_URL or MYSQL_ADDRESS, MYSQL_USERNAME, MYSQL_PASSWORD, and MYSQL_DATABASE.');
      host = match[1] || match[2];
      port = Number(match[3] || 3306);
      user = env.MYSQL_USERNAME?.trim();
      password = env.MYSQL_PASSWORD;
      database = env.MYSQL_DATABASE?.trim();
    }
    requireValue(host && user && password && /^[A-Za-z0-9_-]+$/.test(database || '')
      && Number.isInteger(port) && port > 0 && port <= 65535, 'Explicit MySQL host, user, password, database and valid port are required; no database default is used.');
  } catch (error) {
    if (error instanceof PriceToolError) throw error;
    throw new PriceToolError('Invalid MySQL connection configuration. Connection values are not logged.');
  }
  const targetFingerprint = createHash('sha256').update(JSON.stringify([host.toLowerCase(), port, database])).digest('hex');
  return { targetFingerprint, options: { host, port, user, password, database, charset: 'utf8mb4',
    connectTimeout: 10_000, multipleStatements: false, dateStrings: true, timezone: 'Z' } };
}

export function validatePriceRow(catalog, row) {
  const spec = catalogs[catalog];
  requireValue(spec && row, 'Catalog row is missing.');
  let payload;
  try {
    const value = Buffer.isBuffer(row.payload) ? row.payload.toString('utf8') : row.payload;
    payload = typeof value === 'string' ? JSON.parse(value) : structuredClone(value);
  } catch { throw new PriceToolError('Catalog payload is not valid JSON.'); }
  requireValue(payload && typeof payload === 'object' && !Array.isArray(payload), 'Catalog payload must be an object.');
  requireValue(payload.id === row[spec.key] && typeof payload.enabled === 'boolean'
    && Number(row.enabled) === Number(payload.enabled), 'Catalog ID or enabled index differs from payload.');
  requireValue(validMoney(payload.price) && validMoney(payload.originalPrice), 'Catalog price and originalPrice must be valid nonnegative currency amounts.');
  requireValue(validVersion(row.updated_at), 'Catalog updated_at must be a canonical millisecond UTC timestamp.');
  requireValue(Number.isSafeInteger(Number(row.sort_order)) && Number(row.sort_order) >= 0, 'Catalog sort index is invalid.');
  if (catalog === 'activities') {
    requireValue(payload.startDate === row.start_date && payload.updatedAt === row.updated_at
      && (payload.sort ?? 0) === Number(row.sort_order), 'Activity startDate, sort, or updatedAt differs from indexed columns.');
  } else {
    requireValue(typeof payload.category === 'string' && payload.category === row.category, 'Product category differs from indexed column.');
    requireValue(payload.stock === null || (Number.isSafeInteger(payload.stock) && payload.stock >= 0), 'Product stock is invalid.');
    requireValue(payload.stock === (row.stock === null ? null : Number(row.stock)), 'Product stock differs from indexed column.');
    requireValue(validMoney(payload.shippingFee), 'Product shippingFee is invalid.');
    if (Object.hasOwn(payload, 'updatedAt')) requireValue(payload.updatedAt === row.updated_at, 'Product updatedAt differs from indexed column.');
    if (Object.hasOwn(payload, 'sort')) requireValue(payload.sort === Number(row.sort_order), 'Product sort differs from indexed column.');
  }
  return payload;
}

export function planPriceChange({ catalog, ids, rows, targetFingerprint, restoreSnapshot, now = new Date().toISOString() }) {
  requireValue(validVersion(now), 'Invalid operation timestamp.');
  const spec = catalogs[catalog];
  requireValue(spec && rows.length === ids.length, 'Every requested catalog ID must exist exactly once.');
  const sortedRows = [...rows].sort((a, b) => String(a[spec.key]).localeCompare(String(b[spec.key])));
  // Compare sets independently of locale sorting; SQL and JS collations may differ.
  requireValue(JSON.stringify(sortedRows.map((row) => row[spec.key]).sort()) === JSON.stringify([...ids].sort()), 'Returned catalog IDs do not match the explicit targets.');
  const decoded = sortedRows.map((row) => ({ row, payload: validatePriceRow(catalog, row) }));
  const version = new Date(Math.max(Date.parse(now), ...decoded.map(({ row }) => Date.parse(row.updated_at) + 1))).toISOString();
  let restoration;
  if (restoreSnapshot) {
    requireValue(restoreSnapshot.kind === snapshotKind && restoreSnapshot.catalog === catalog
      && restoreSnapshot.targetFingerprint === targetFingerprint && typeof restoreSnapshot.operationId === 'string'
      && Array.isArray(restoreSnapshot.items) && restoreSnapshot.items.length === ids.length,
    'Restore snapshot does not match this database, catalog, or target count.');
    requireValue(JSON.stringify(restoreSnapshot.items.map((item) => item?.id).sort()) === JSON.stringify([...ids].sort()), 'Restore snapshot IDs must exactly match --ids.');
    restoration = new Map(restoreSnapshot.items.map((item) => [item.id, item]));
  }
  const changes = decoded.map(({ row, payload }) => {
    const previous = restoration?.get(payload.id);
    if (restoration) requireValue(previous && validMoney(previous.beforePrice) && validVersion(previous.beforeVersion)
      && validVersion(previous.testVersion) && previous.testPrice === 0.01
      && previous.changed === (previous.beforePrice !== 0.01)
      && row.updated_at === previous.testVersion && payload.price === previous.testPrice,
    'Restore conflict: current price/version is not from this test round. Do not overwrite later operational edits.');
    const nextPrice = previous ? previous.beforePrice : 0.01;
    const changed = payload.price !== nextPrice;
    const nextVersion = changed ? version : row.updated_at;
    const nextPayload = { ...payload, price: nextPrice };
    if (catalog === 'activities' || Object.hasOwn(payload, 'updatedAt')) nextPayload.updatedAt = nextVersion;
    return { id: payload.id, changed, beforePrice: payload.price, beforeVersion: row.updated_at, price: nextPrice, version: nextVersion, payload: nextPayload };
  });
  const snapshot = restoration ? null : {
    kind: snapshotKind, operationId: randomUUID(), catalog, targetFingerprint, createdAt: now,
    items: changes.map((item) => ({ id: item.id, changed: item.changed, beforePrice: item.beforePrice, beforeVersion: item.beforeVersion, testPrice: 0.01, testVersion: item.version })),
  };
  return { changes, snapshot };
}

export async function writePriceSnapshot(path, snapshot) {
  // Exclusive creation also rejects an existing file or symlink. Never overwrite a backup.
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(`${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await file.sync();
  } finally { await file.close(); }
  if (process.platform !== 'win32') {
    const directory = await open(dirname(path), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  }
}

export async function executePriceChange({ connection, options, targetFingerprint, restoreSnapshot, saveSnapshot = writePriceSnapshot }) {
  const spec = catalogs[options.catalog];
  requireValue(Boolean(options.restore) === Boolean(restoreSnapshot)
    && (!options.restore || (typeof restoreSnapshot === 'object' && !Array.isArray(restoreSnapshot))),
  'Restoration requires a valid snapshot object; a missing or null snapshot cannot become a new test-price operation.');
  let transactionStarted = false;
  try {
    if (!options.apply) await connection.query('SET TRANSACTION READ ONLY');
    await connection.beginTransaction();
    transactionStarted = true;
    const [states] = await connection.execute(
      `SELECT seed_version FROM worker_house_catalog_state WHERE catalog_name = ?${options.apply ? ' FOR SHARE' : ''}`,
      [options.catalog],
    );
    requireValue(states.length === 1 && Number(states[0].seed_version) >= 1, 'Catalog must already be initialized (seed_version >= 1); this tool never migrates or seeds data.');
    const rows = [];
    for (const id of options.ids) {
      const [selected] = await connection.execute(
        `SELECT ${spec.key}, ${spec.columns} FROM ${spec.table} WHERE ${spec.key} = ?${options.apply ? ' FOR UPDATE' : ''}`, [id],
      );
      requireValue(selected.length === 1, 'A requested catalog ID is missing or duplicated; no prices were changed.');
      rows.push(selected[0]);
    }
    const plan = planPriceChange({ catalog: options.catalog, ids: options.ids, rows, targetFingerprint, restoreSnapshot });
    const changedItems = plan.changes.filter((change) => change.changed);
    if (options.apply) {
      requireValue(options.confirmSalesPaused, 'Applying prices requires explicit confirmation that new sales are paused and in-flight creation has drained.');
      if (plan.snapshot && changedItems.length > 0) await saveSnapshot(options.snapshot, plan.snapshot);
      for (const change of changedItems) {
        const updatePayloadVersion = options.catalog === 'activities' || Object.hasOwn(change.payload, 'updatedAt');
        const [result] = await connection.execute(
          `UPDATE ${spec.table} SET payload = JSON_SET(payload, '$.price', ?${updatePayloadVersion ? ", '$.updatedAt', ?" : ''}), updated_at = ? WHERE ${spec.key} = ? AND updated_at = ?`,
          [change.price, ...(updatePayloadVersion ? [change.version] : []), change.version, change.id, change.beforeVersion],
        );
        requireValue(result.affectedRows === 1, 'Catalog changed during update; the whole transaction was rolled back.');
      }
      await connection.commit();
    } else await connection.rollback();
    transactionStarted = false;
    return { mode: options.apply ? changedItems.length > 0 ? 'applied' : 'no-op' : 'preview', action: restoreSnapshot ? 'restore' : 'one-cent-test',
      catalog: options.catalog, targetFingerprint,
      changes: plan.changes.map(({ id, changed, beforePrice, price }) => ({ id, changed, beforePrice, price })),
      snapshot: options.apply && plan.snapshot && changedItems.length > 0 ? options.snapshot : undefined,
      note: options.apply ? 'Snapshot is a prepared recovery record, not proof of commit. Existing orders and all other business fields remain unchanged.' : 'Preview only; no prices or snapshot files were written.' };
  } catch (error) {
    if (transactionStarted) { try { await connection.rollback(); } catch {} }
    throw error;
  }
}

async function main() {
  const options = parsePriceArguments(process.argv.slice(2));
  const configuration = readPriceConnection(process.env);
  const restoreSnapshot = options.restore ? JSON.parse(await readFile(options.restore, 'utf8')) : undefined;
  const mysql = await import('mysql2/promise');
  const connection = await mysql.default.createConnection(configuration.options);
  try {
    const report = await executePriceChange({ connection, options, targetFingerprint: configuration.targetFingerprint, restoreSnapshot });
    console.log(JSON.stringify(report, null, 2));
  } finally { await connection.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const safeCode = typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? ` (${error.code})` : '';
    console.error(error instanceof PriceToolError ? error.message : `Price operation failed${safeCode}. Connection/error details are withheld. A saved snapshot may precede an uncertain commit; inspect database price/version before retrying.`);
    process.exitCode = 1;
  });
}
