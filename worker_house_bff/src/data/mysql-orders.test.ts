import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readShopOrderStorage } from '../config.js';
import {
  decodeMysqlOrderPayload,
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

test('decodes MySQL JSON payloads without changing cents, nulls or UTC timestamps', () => {
  for (const payload of [sampleOrder, JSON.stringify(sampleOrder), Buffer.from(JSON.stringify(sampleOrder))]) {
    const decoded = decodeMysqlOrderPayload(payload);
    assert.equal(decoded.amount, 1);
    assert.equal(decoded.address, null);
    assert.equal(decoded.expiresAt, '2026-08-03T01:02:03.000Z');
    assert.equal(decoded.createdAt, '2026-08-03T00:00:00.000Z');
  }
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
});

test('maps the retired CloudBase storage value to MySQL during service-variable migration', () => {
  assert.equal(readShopOrderStorage('cloudbase', 'cloudrun'), 'mysql');
  assert.equal(readShopOrderStorage(' mysql ', 'cloudrun'), 'mysql');
  assert.throws(() => readShopOrderStorage('cloudbase', 'mock'), /仅允许云托管迁移期兼容/);
  assert.throws(() => readShopOrderStorage('cloudbase', 'wechat'), /仅允许云托管迁移期兼容/);
  assert.throws(() => readShopOrderStorage('unsupported', 'cloudrun'), /不支持/);
});
