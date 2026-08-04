import mysql from 'mysql2/promise';
import { config } from '../config.js';
import { ActivityCapacityExceededError, cloneOrder, hasActivePaymentPreparation, hasActiveWechatShippingReport, normalizeOrder, nowIso, sanitizeOrderString, } from './order-model.js';
const ORDERS_TABLE = 'worker_house_orders';
const ACTIVITY_LOCKS_TABLE = 'worker_house_activity_locks';
const MIGRATIONS_TABLE = 'worker_house_schema_migrations';
const INITIAL_MIGRATION = '001_mysql_order_storage';
const MAX_TRANSACTION_ATTEMPTS = 3;
const MYSQL_READ_RETRY_DELAYS_MS = [50, 150];
const RETRIABLE_MYSQL_READ_CODES = new Set([
    'ECONNRESET',
    'EPIPE',
    'PROTOCOL_CONNECTION_LOST',
]);
let pool = null;
let schemaReady = null;
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
];
export function getMysqlOrderStorageConfigurationIssues() {
    if (config.mysql.url)
        return [];
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
        const error = new Error(`MySQL 订单库配置不完整：${issues.join('、')}`);
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
    };
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
function getPool() {
    if (!pool)
        pool = createMysqlPool();
    return pool;
}
function getMysqlError(error) {
    return error && typeof error === 'object' ? error : {};
}
function getMysqlErrorCode(error) {
    const code = getMysqlError(error).code;
    return typeof code === 'string' ? code : '';
}
export function isRetriableMysqlReadError(error) {
    let current = error;
    const seen = new Set();
    while (current && typeof current === 'object' && !seen.has(current)) {
        if (RETRIABLE_MYSQL_READ_CODES.has(getMysqlErrorCode(current).toUpperCase()))
            return true;
        seen.add(current);
        current = current.cause;
    }
    return false;
}
export async function retryTransientMysqlRead(read, retryDelaysMs = MYSQL_READ_RETRY_DELAYS_MS) {
    for (let attempt = 0;; attempt += 1) {
        try {
            return await read();
        }
        catch (error) {
            if (!isRetriableMysqlReadError(error) || attempt >= retryDelaysMs.length)
                throw error;
            const delay = Math.max(0, retryDelaysMs[attempt] || 0);
            if (delay > 0)
                await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}
function runMysqlRead(read) {
    // mysql2 removes a fatally disconnected pooled connection. A fresh acquisition
    // therefore recovers the common CloudRun/MySQL idle-connection reset safely.
    return retryTransientMysqlRead(() => read(getPool()));
}
function isRetriableTransactionError(error) {
    return ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(getMysqlErrorCode(error));
}
function isDuplicateEntryError(error) {
    return getMysqlErrorCode(error) === 'ER_DUP_ENTRY';
}
export function formatMysqlOrderStorageError(error) {
    const input = getMysqlError(error);
    const code = typeof input.code === 'string' ? input.code : 'MYSQL_ERROR';
    const errno = typeof input.errno === 'number' ? String(input.errno) : '';
    const sqlState = typeof input.sqlState === 'string' ? input.sqlState : '';
    let message = typeof input.message === 'string' ? input.message : String(error || 'unknown');
    message = message
        .replace(/\bmysql:\/\/[^\s"'`]+/gi, 'mysql://[REDACTED_CONNECTION]')
        .replace(/(password\s*[=:]\s*)[^\s,;]+/gi, '$1***');
    if (config.mysql.password)
        message = message.split(config.mysql.password).join('***');
    return [code, errno, sqlState, message].filter(Boolean).join(' ');
}
async function runTransaction(work) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        const connection = await getPool().getConnection();
        try {
            await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
            await connection.beginTransaction();
            const result = await work(connection);
            await connection.commit();
            return result;
        }
        catch (error) {
            lastError = error;
            try {
                await connection.rollback();
            }
            catch {
                // 原始事务错误优先返回。
            }
            if (!isRetriableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS)
                throw error;
            await new Promise((resolve) => setTimeout(resolve, attempt * 30));
        }
        finally {
            connection.release();
        }
    }
    throw lastError;
}
export function decodeMysqlOrderPayload(payload) {
    let value = payload;
    if (Buffer.isBuffer(value))
        value = value.toString('utf8');
    if (typeof value === 'string')
        value = JSON.parse(value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        const error = new Error('MySQL 订单 payload 格式无效');
        error.code = 'MYSQL_ORDER_PAYLOAD_INVALID';
        throw error;
    }
    return normalizeOrder(value);
}
async function selectOrderById(executor, orderId, forUpdate = false) {
    const [rows] = await executor.execute(`SELECT payload FROM ${ORDERS_TABLE} WHERE order_id = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`, [sanitizeOrderString(orderId)]);
    return rows[0] ? decodeMysqlOrderPayload(rows[0].payload) : null;
}
async function selectOrders(executor, sql, parameters) {
    const [rows] = await executor.execute(sql, parameters);
    return rows.map((row) => decodeMysqlOrderPayload(row.payload));
}
function orderIndexValues(order) {
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
async function insertOrder(connection, order) {
    await connection.execute(`INSERT INTO ${ORDERS_TABLE} (
      order_id, kind, client_request_id, product_id, openid, status,
      transaction_id, created_at, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, orderIndexValues(order));
}
async function replaceOrder(connection, order) {
    await connection.execute(`UPDATE ${ORDERS_TABLE}
     SET kind = ?, client_request_id = ?, product_id = ?, openid = ?, status = ?,
         transaction_id = ?, created_at = ?, updated_at = ?, payload = ?
     WHERE order_id = ?`, [
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
    ]);
}
async function ensureActivityLock(connection, activityId, capacity) {
    const currentParticipants = Math.max(0, Math.floor(Number(capacity?.currentParticipants) || 0));
    const maxParticipants = Math.max(0, Math.floor(Number(capacity?.maxParticipants) || 0));
    const configurationVersion = sanitizeOrderString(capacity?.configurationVersion)
        || '1970-01-01T00:00:00.000Z';
    if (capacity) {
        await connection.execute(`INSERT INTO ${ACTIVITY_LOCKS_TABLE}
        (activity_id, base_participants, max_participants, updated_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        base_participants = IF(VALUES(updated_at) > updated_at, VALUES(base_participants), base_participants),
        max_participants = IF(VALUES(updated_at) > updated_at, VALUES(max_participants), max_participants),
        updated_at = GREATEST(updated_at, VALUES(updated_at))`, [activityId, currentParticipants, maxParticipants, configurationVersion]);
    }
    else {
        await connection.execute(`INSERT IGNORE INTO ${ACTIVITY_LOCKS_TABLE}
       (activity_id, base_participants, max_participants, updated_at)
       VALUES (?, 0, 0, ?)`, [activityId, '1970-01-01T00:00:00.000Z']);
    }
    const [rows] = await connection.execute(`SELECT base_participants, max_participants
     FROM ${ACTIVITY_LOCKS_TABLE} WHERE activity_id = ? FOR UPDATE`, [activityId]);
    return {
        currentParticipants: Math.max(0, Math.floor(Number(rows[0]?.base_participants) || 0)),
        maxParticipants: Math.max(0, Math.floor(Number(rows[0]?.max_participants) || 0)),
    };
}
async function applyInitialSchema() {
    const database = getPool();
    for (const statement of INITIAL_SCHEMA_STATEMENTS) {
        await database.query(statement);
    }
    await database.execute(`INSERT IGNORE INTO ${MIGRATIONS_TABLE} (version, applied_at) VALUES (?, ?)`, [INITIAL_MIGRATION, nowIso()]);
}
async function verifySchema() {
    const database = getPool();
    await database.query('SELECT 1');
    await database.query(`SELECT order_id FROM ${ORDERS_TABLE} LIMIT 0`);
    await database.query(`SELECT activity_id FROM ${ACTIVITY_LOCKS_TABLE} LIMIT 0`);
}
async function ensureSchemaReady() {
    if (!schemaReady) {
        schemaReady = retryTransientMysqlRead(() => config.mysql.autoMigrate ? applyInitialSchema() : verifySchema())
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
    if (!pool)
        return;
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
    }
    catch (error) {
        console.error(`[orders store] mysql readiness error ${formatMysqlOrderStorageError(error)}`);
        return false;
    }
}
export async function createMysqlOrder(record) {
    await ensureSchemaReady();
    try {
        return await runTransaction(async (connection) => {
            const existing = await selectOrderById(connection, record.id, true);
            if (existing)
                return cloneOrder(existing);
            await insertOrder(connection, record);
            return cloneOrder(record);
        });
    }
    catch (error) {
        if (!isDuplicateEntryError(error))
            throw error;
        const existing = await runMysqlRead((database) => selectOrderById(database, record.id));
        if (existing)
            return cloneOrder(existing);
        throw error;
    }
}
export async function createMysqlActivityOrderWithCapacity(record, capacity) {
    await ensureSchemaReady();
    try {
        return await runTransaction(async (connection) => {
            const lockedCapacity = await ensureActivityLock(connection, record.productId, capacity);
            const duplicate = await selectOrderById(connection, record.id, true);
            if (duplicate)
                return cloneOrder(duplicate);
            const existingOrders = await selectOrders(connection, `SELECT payload FROM ${ORDERS_TABLE}
         WHERE product_id = ? AND kind = 'activity' AND openid = ?
           AND status IN ('pending', 'paid')
         ORDER BY (status = 'paid') DESC, created_at ASC
         LIMIT 1`, [record.productId, record.openid]);
            if (existingOrders[0])
                return cloneOrder(existingOrders[0]);
            const [countRows] = await connection.execute(`SELECT COUNT(*) AS total FROM ${ORDERS_TABLE}
         WHERE product_id = ? AND kind = 'activity' AND status IN ('pending', 'paid')`, [record.productId]);
            const activeReservations = Number(countRows[0]?.total || 0);
            const { currentParticipants, maxParticipants } = lockedCapacity;
            if (maxParticipants > 0 && currentParticipants + activeReservations + 1 > maxParticipants) {
                throw new ActivityCapacityExceededError();
            }
            await insertOrder(connection, record);
            return cloneOrder(record);
        });
    }
    catch (error) {
        if (!isDuplicateEntryError(error))
            throw error;
        const existing = await runMysqlRead((database) => selectOrderById(database, record.id));
        if (existing)
            return cloneOrder(existing);
        throw error;
    }
}
export async function getMysqlOrderById(orderId) {
    await ensureSchemaReady();
    const order = await runMysqlRead((database) => selectOrderById(database, orderId));
    return order ? cloneOrder(order) : null;
}
export async function getMysqlOrdersByOpenid(openid, kind) {
    await ensureSchemaReady();
    const parameters = [openid];
    const kindClause = kind ? ' AND kind = ?' : '';
    if (kind)
        parameters.push(kind);
    return cloneOrder(await runMysqlRead((database) => selectOrders(database, `SELECT payload FROM ${ORDERS_TABLE}
     WHERE openid = ?${kindClause}
     ORDER BY created_at DESC`, parameters)));
}
export async function getMysqlOrdersByProductId(productId, kind) {
    await ensureSchemaReady();
    const parameters = [productId];
    const kindClause = kind ? ' AND kind = ?' : '';
    if (kind)
        parameters.push(kind);
    return cloneOrder(await runMysqlRead((database) => selectOrders(database, `SELECT payload FROM ${ORDERS_TABLE} WHERE product_id = ?${kindClause}`, parameters)));
}
export async function getMysqlOrdersByKind(kind) {
    await ensureSchemaReady();
    return cloneOrder(await runMysqlRead((database) => selectOrders(database, `SELECT payload FROM ${ORDERS_TABLE} WHERE kind = ? ORDER BY created_at DESC`, [kind])));
}
export async function claimMysqlOrderPaymentPreparation(orderId, token, leaseMilliseconds) {
    await ensureSchemaReady();
    const preparingUntil = new Date(Date.now() + Math.max(1_000, leaseMilliseconds)).toISOString();
    return runTransaction(async (connection) => {
        const current = await selectOrderById(connection, orderId, true);
        if (!current)
            return { claimed: false, order: null };
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
export async function finishMysqlOrderPaymentPreparation(orderId, token, input) {
    await ensureSchemaReady();
    return runTransaction(async (connection) => {
        const current = await selectOrderById(connection, orderId, true);
        if (!current)
            return null;
        if (current.prepayId || current.status !== 'pending')
            return cloneOrder(current);
        if (current.paymentPreparationToken !== sanitizeOrderString(token))
            return cloneOrder(current);
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
export async function claimMysqlOrderFulfillmentReport(orderId, fulfilledBy, token, leaseMilliseconds) {
    await ensureSchemaReady();
    return runTransaction(async (connection) => {
        const current = await selectOrderById(connection, orderId, true);
        if (!current)
            return { claimed: false, order: null, reportRequired: false };
        const reportRequired = current.status === 'paid'
            && !current.mock
            && current.amount > 0;
        const fulfillmentPatch = {
            fulfillmentStatus: 'fulfilled',
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
export async function finishMysqlOrderFulfillmentReport(orderId, token, input) {
    await ensureSchemaReady();
    return runTransaction(async (connection) => {
        const current = await selectOrderById(connection, orderId, true);
        if (!current)
            return null;
        if (current.wechatShippingStatus === 'reported')
            return cloneOrder(current);
        if (current.wechatShippingReportToken !== sanitizeOrderString(token))
            return cloneOrder(current);
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
async function updateLockedOrderStatus(connection, current, status, options) {
    if (current.status === 'paid' && status !== 'paid')
        return cloneOrder(current);
    if (current.status === 'paid'
        && status === 'paid'
        && current.transactionId
        && options.transactionId
        && current.transactionId !== options.transactionId) {
        const error = new Error('已支付订单的微信支付流水号不一致');
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
export async function updateMysqlOrderStatus(orderId, status, options = {}) {
    await ensureSchemaReady();
    const snapshot = await runMysqlRead((database) => selectOrderById(database, orderId));
    if (!snapshot)
        return null;
    return runTransaction(async (connection) => {
        if (snapshot.kind === 'activity')
            await ensureActivityLock(connection, snapshot.productId);
        const current = await selectOrderById(connection, orderId, true);
        if (!current)
            return null;
        if (current.kind === 'activity' && current.productId !== snapshot.productId) {
            throw new Error('活动订单不可变字段发生冲突');
        }
        return updateLockedOrderStatus(connection, current, status, options);
    });
}
