import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readShopOrderStorage } from '../config.js';
import {
  assertShopOrderMatchesCatalog,
  assertShopStockMigrationApplied,
  decodeMysqlOrderPayload,
  decodeMysqlOrderRow,
  formatMysqlOrderStorageError,
  isRetriableMysqlReadError,
  retryTransientMysqlRead,
} from './mysql-orders.js';

const sampleOrder = {
  id: 'WH_MYSQL_CODEC',
  kind: 'shop',
  clientRequestId: 'request-mysql-codec',
  productId: 'cocktail-001',
  productName: '测试鸡尾酒',
  productImageUrl: '',
  unitPrice: 1,
  quantity: 1,
  amount: 1,
  address: null,
  fulfillmentType: 'onsite',
  fulfillmentLabel: '到店享用',
  unitLabel: '杯',
  openid: 'openid-mysql-codec',
  remark: '',
  status: 'pending',
  mock: false,
  prepayId: '',
  paymentPreparationToken: '',
  paymentPreparingUntil: '',
  transactionId: '',
  paidAt: '',
  expiresAt: '2026-08-03T01:02:03.000Z',
  failureReason: '',
  lastNotifyId: '',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

test('validates the locked shop catalog against the immutable financial and fulfillment snapshot', () => {
  const order = { ...decodeMysqlOrderPayload(sampleOrder), shippingFee: 2, quantity: 2, amount: 4 };
  const product = {
    id: order.productId,
    enabled: true,
    price: 0.01,
    shippingFee: 0.02,
    minQuantity: 1,
    maxQuantity: 3,
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
  };
  for (const payload of [product, JSON.stringify(product), Buffer.from(JSON.stringify(product))]) {
    assert.doesNotThrow(() => assertShopOrderMatchesCatalog(order, payload));
  }
  const invalidConfigurations = [
    { price: 0.02 }, { price: '0.01' }, { price: 0.001 },
    { shippingFee: 0 }, { shippingFee: undefined },
    { minQuantity: 3 }, { maxQuantity: 1 }, { maxQuantity: 100 }, { minQuantity: '1' },
    { fulfillmentType: 'pickup' }, { fulfillmentType: undefined },
    { fulfillmentLabel: '自取' }, { unitLabel: '瓶' }, { enabled: false }, { id: 'other' },
  ];
  for (const patch of invalidConfigurations) {
    assert.throws(
      () => assertShopOrderMatchesCatalog(order, { ...product, ...patch }),
      (error: unknown) => (error as { code?: string }).code === 'SHOP_STOCK_CONFIGURATION_CHANGED',
      JSON.stringify(patch),
    );
  }
  for (const patch of [{ amount: 1 }, { unitPrice: 2 }, { shippingFee: 0 }, { quantity: 1 }]) {
    assert.throws(() => assertShopOrderMatchesCatalog({ ...order, ...patch }, product));
  }
  assert.throws(() => assertShopOrderMatchesCatalog(order, '{invalid json'));
  assert.throws(() => assertShopOrderMatchesCatalog(
    { ...order, fulfillmentType: 'delivery' },
    { ...product, fulfillmentType: 'delivery' },
  ));
  assert.equal(order.amount, 4, 'configuration validation must never reprice the order');
});

test('decodes MySQL JSON payloads without changing cents, nulls or UTC timestamps', () => {
  for (const payload of [sampleOrder, JSON.stringify(sampleOrder), Buffer.from(JSON.stringify(sampleOrder))]) {
    const decoded = decodeMysqlOrderPayload(payload);
    assert.equal(decoded.amount, 1);
    assert.equal(decoded.address, null);
    assert.equal(decoded.expiresAt, '2026-08-03T01:02:03.000Z');
    assert.equal(decoded.createdAt, '2026-08-03T00:00:00.000Z');
  }
});

test('fails closed when indexed order fields drift from the JSON payload', () => {
  const indexedRow = {
    order_id: sampleOrder.id,
    kind: sampleOrder.kind,
    product_id: sampleOrder.productId,
    status: sampleOrder.status,
    payload: sampleOrder,
  };
  assert.equal(decodeMysqlOrderRow(indexedRow).id, sampleOrder.id);
  for (const patch of [
    { order_id: 'WH_DIFFERENT' },
    { kind: 'activity' },
    { product_id: 'different-product' },
    { status: 'closed' },
  ]) {
    assert.throws(
      () => decodeMysqlOrderRow({ ...indexedRow, ...patch }),
      (error: unknown) => (error as { code?: string }).code === 'MYSQL_ORDER_INDEX_MISMATCH',
    );
  }
});

test('requires the stock reservation migration marker when auto-migrate is disabled', () => {
  assert.doesNotThrow(() => assertShopStockMigrationApplied([
    { version: '003_mysql_shop_stock_reservations' },
  ]));
  assert.throws(
    () => assertShopStockMigrationApplied([]),
    (error: unknown) => (error as { code?: string }).code === 'MYSQL_SCHEMA_MIGRATION_REQUIRED',
  );
  assert.throws(
    () => assertShopStockMigrationApplied([{ version: '001_mysql_order_storage' }]),
    (error: unknown) => (error as { code?: string }).code === 'MYSQL_SCHEMA_MIGRATION_REQUIRED',
  );
});

test('redacts credentials when formatting MySQL driver errors', () => {
  const formatted = formatMysqlOrderStorageError(Object.assign(
    new Error('connect mysql://worker:super-secret@10.0.0.8:3306/worker_house failed'),
    { code: 'ECONNREFUSED', errno: -61 },
  ));
  assert.match(formatted, /ECONNREFUSED/);
  assert.doesNotMatch(formatted, /super-secret/);
  assert.match(formatted, /mysql:\/\/\[REDACTED_CONNECTION\]/);
});

test('retries safe MySQL reads after transient pooled-connection resets', async () => {
  let attempts = 0;
  const result = await retryTransientMysqlRead(async () => {
    attempts += 1;
    if (attempts < 3) {
      throw Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    }
    return 'recovered';
  }, [0, 0]);

  assert.equal(result, 'recovered');
  assert.equal(attempts, 3);
  assert.equal(isRetriableMysqlReadError({ cause: { code: 'EPIPE' } }), true);
});

test('does not retry non-transient MySQL failures', async () => {
  let attempts = 0;
  await assert.rejects(
    retryTransientMysqlRead(async () => {
      attempts += 1;
      throw Object.assign(new Error('access denied'), { code: 'ER_ACCESS_DENIED_ERROR' });
    }, [0, 0]),
    (error: unknown) => (error as { code?: string }).code === 'ER_ACCESS_DENIED_ERROR',
  );
  assert.equal(attempts, 1);
});

test('ships an InnoDB utf8mb4 schema with the required order indexes', () => {
  const migration = readFileSync(new URL('../../sql/001_mysql_order_storage.sql', import.meta.url), 'utf8');
  assert.match(migration, /ENGINE=InnoDB/);
  assert.match(migration, /utf8mb4/);
  assert.match(migration, /PRIMARY KEY \(order_id\)/);
  assert.match(migration, /idx_orders_openid_kind_created/);
  assert.match(migration, /idx_orders_product_kind_status/);
  assert.match(migration, /worker_house_activity_locks/);

  const stockMigration = readFileSync(
    new URL('../../sql/003_mysql_shop_stock_reservations.sql', import.meta.url),
    'utf8',
  );
  assert.match(stockMigration, /worker_house_shop_stock_locks/);
  assert.match(stockMigration, /stock_limit BIGINT UNSIGNED NULL/);
  assert.match(stockMigration, /updated_at VARCHAR\(32\)/);
  assert.match(stockMigration, /PRIMARY KEY \(product_id\)/);
  assert.match(stockMigration, /003_mysql_shop_stock_reservations/);
});

test('maps the retired CloudBase storage value to MySQL during service-variable migration', () => {
  assert.equal(readShopOrderStorage('cloudbase', 'cloudrun'), 'mysql');
  assert.equal(readShopOrderStorage(' mysql ', 'cloudrun'), 'mysql');
  assert.throws(() => readShopOrderStorage('cloudbase', 'mock'), /仅允许云托管迁移期兼容/);
  assert.throws(() => readShopOrderStorage('cloudbase', 'wechat'), /仅允许云托管迁移期兼容/);
  assert.throws(() => readShopOrderStorage('unsupported', 'cloudrun'), /不支持/);
});
