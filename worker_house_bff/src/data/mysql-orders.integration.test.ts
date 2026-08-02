import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import test from 'node:test';

const testUrl = process.env.MYSQL_TEST_URL?.trim() || '';

test('serializes real MySQL order creation, payment leases and activity capacity', {
  skip: !testUrl,
}, async (context) => {
  process.env.MODE = 'cloudrun';
  process.env.SHOP_ORDER_STORAGE = 'mysql';
  process.env.MYSQL_URL = testUrl;
  process.env.MYSQL_AUTO_MIGRATE = 'true';

  const mysqlStore = await import('./mysql-orders.js');
  const orders = await import('./orders.js');
  context.after(() => mysqlStore.closeMysqlOrderStorage());
  await mysqlStore.migrateMysqlOrderStorage();

  const cleanupConnection = await mysql.createConnection(testUrl);
  try {
    await cleanupConnection.query('DELETE FROM worker_house_orders');
    await cleanupConnection.query('DELETE FROM worker_house_activity_locks');
  } finally {
    await cleanupConnection.end();
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1_000).toISOString();
  const shopInput = {
    id: 'WH_MYSQL_INTEGRATION_ORDER',
    clientRequestId: 'mysql-integration-shop-request',
    productId: 'cocktail-mysql-test',
    productName: 'MySQL 测试鸡尾酒',
    productImageUrl: '',
    unitPrice: 1,
    quantity: 1,
    amount: 1,
    address: null,
    fulfillmentType: 'onsite' as const,
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    openid: 'openid-mysql-shop',
    status: 'pending' as const,
    mock: false,
    expiresAt,
  };
  const firstOrder = await orders.createOrder(shopInput);
  const duplicateOrders = await Promise.all([
    orders.createOrder({ ...shopInput, amount: 999 }),
    orders.createOrder({ ...shopInput, amount: 500 }),
  ]);
  assert.ok(duplicateOrders.every((item) => item.id === firstOrder.id));
  assert.ok(duplicateOrders.every((item) => item.amount === 1));

  const leaseClaims = await Promise.all([
    orders.claimOrderPaymentPreparation(firstOrder.id, 'mysql-lease-first', 10_000),
    orders.claimOrderPaymentPreparation(firstOrder.id, 'mysql-lease-second', 10_000),
  ]);
  assert.equal(leaseClaims.filter((item) => item.claimed).length, 1);

  const buildActivityOrder = (id: string, openid: string) => ({
    id,
    kind: 'activity' as const,
    clientRequestId: `request-${id}`,
    productId: 'act-mysql-last-seat',
    productName: 'MySQL 最后名额测试',
    productImageUrl: '',
    unitPrice: 1,
    quantity: 1,
    amount: 1,
    address: null,
    fulfillmentType: 'onsite' as const,
    fulfillmentLabel: '现场参与',
    unitLabel: '位',
    openid,
    status: 'pending' as const,
    mock: false,
    expiresAt,
  });
  const activityResults = await Promise.allSettled([
    orders.createActivityOrderWithCapacity(
      buildActivityOrder('WA_MYSQL_LAST_SEAT_FIRST', 'openid-mysql-a'),
      { currentParticipants: 0, maxParticipants: 1, configurationVersion: '2026-08-03T00:00:00.000Z' },
    ),
    orders.createActivityOrderWithCapacity(
      buildActivityOrder('WA_MYSQL_LAST_SEAT_SECOND', 'openid-mysql-b'),
      { currentParticipants: 0, maxParticipants: 1, configurationVersion: '2026-08-03T00:00:00.000Z' },
    ),
  ]);
  assert.equal(activityResults.filter((item) => item.status === 'fulfilled').length, 1);
  const rejected = activityResults.find((item) => item.status === 'rejected');
  assert.ok(rejected && rejected.status === 'rejected');
  assert.equal(orders.isActivityCapacityExceededError(rejected.reason), true);

  await assert.rejects(
    orders.createActivityOrderWithCapacity(
      buildActivityOrder('WA_MYSQL_STALE_CAPACITY', 'openid-mysql-stale'),
      { currentParticipants: 0, maxParticipants: 99, configurationVersion: '2026-08-02T00:00:00.000Z' },
    ),
    (error: unknown) => orders.isActivityCapacityExceededError(error),
  );
});
