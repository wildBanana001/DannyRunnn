import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import test from 'node:test';
import type { ShopProduct } from './shop.js';

const testUrl = process.env.MYSQL_TEST_URL?.trim() || '';
const orderIds = [
  'WH_MYSQL_INTEGRATION_ORDER',
  'WH_MYSQL_STOCK_FIRST',
  'WH_MYSQL_STOCK_SECOND',
  'WH_MYSQL_STOCK_REPLACEMENT',
  'WH_MYSQL_STALE_CONFIG',
  'WA_MYSQL_LAST_SEAT_FIRST',
  'WA_MYSQL_LAST_SEAT_SECOND',
  'WA_MYSQL_LATE_REPLACEMENT',
  'WA_MYSQL_STALE_CAPACITY',
] as const;
const shopProductIds = ['cocktail-mysql-test', 'product-mysql-stock'] as const;

function assertDedicatedTestDatabase(connectionUrl: string) {
  const databaseName = decodeURIComponent(new URL(connectionUrl).pathname.replace(/^\//, ''));
  assert.match(databaseName, /(?:^|[_-])test(?:$|[_-])/i, 'MYSQL_TEST_URL 必须指向独立测试数据库');
}

test('serializes real MySQL order creation, finite stock, payment leases and activity capacity', {
  skip: !testUrl,
}, async (context) => {
  assertDedicatedTestDatabase(testUrl);
  process.env.MODE = 'cloudrun';
  process.env.SHOP_ORDER_STORAGE = 'mysql';
  process.env.MYSQL_URL = testUrl;
  process.env.MYSQL_AUTO_MIGRATE = 'true';

  const mysqlStore = await import('./mysql-orders.js');
  const catalogs = await import('./mysql-catalogs.js');
  const orders = await import('./orders.js');
  await mysqlStore.migrateMysqlOrderStorage();
  await catalogs.migrateMysqlCatalogStorage();

  const cleanupConnection = await mysql.createConnection(testUrl);
  const cleanup = async () => {
    await cleanupConnection.query(
      `DELETE FROM worker_house_orders WHERE order_id IN (${orderIds.map(() => '?').join(', ')})`,
      [...orderIds],
    );
    await cleanupConnection.query(
      "DELETE FROM worker_house_activity_locks WHERE activity_id = 'act-mysql-last-seat'",
    );
    await cleanupConnection.query(
      "DELETE FROM worker_house_activities WHERE activity_id = 'act-mysql-last-seat'",
    );
    await cleanupConnection.query(
      `DELETE FROM worker_house_shop_stock_locks WHERE product_id IN (${shopProductIds.map(() => '?').join(', ')})`,
      [...shopProductIds],
    );
    await cleanupConnection.query(
      `DELETE FROM worker_house_shop_products WHERE product_id IN (${shopProductIds.map(() => '?').join(', ')})`,
      [...shopProductIds],
    );
  };
  context.after(async () => {
    try {
      await cleanup();
    } finally {
      await cleanupConnection.end();
      await mysqlStore.closeMysqlOrderStorage();
    }
  });
  await cleanup();

  const insertCatalogProduct = async (
    productId: string,
    stock: number | null,
    patch: Partial<ShopProduct> = {},
  ) => {
    const timestamp = new Date().toISOString();
    const product: ShopProduct = {
      enabled: true, id: productId, name: 'MySQL 测试鸡尾酒', price: 0.01, originalPrice: 0.01,
      imageUrl: '', description: '', tags: [], category: 'test',
      fulfillmentType: 'onsite', fulfillmentLabel: '到店享用', unitLabel: '杯',
      alcoholic: false, abv: 0, volumeMl: 0, shippingFee: 0,
      minQuantity: 1, maxQuantity: 99, stock, ...patch,
    };
    await cleanupConnection.query(
      `INSERT INTO worker_house_shop_products
        (product_id, enabled, category, sort_order, stock, updated_at, payload)
       VALUES (?, ?, 'test', 0, ?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), stock = VALUES(stock),
         updated_at = VALUES(updated_at), payload = VALUES(payload)`,
      [productId, product.enabled ? 1 : 0, product.stock, timestamp, JSON.stringify(product)],
    );
  };
  await insertCatalogProduct('cocktail-mysql-test', null);
  await insertCatalogProduct('product-mysql-stock', 2);

  const activityConfigurationVersion = '2026-09-03T00:00:00.000Z';
  const activityPayload = {
    id: 'act-mysql-last-seat',
    title: 'MySQL 最后名额测试',
    description: '事务内锁定活动目录测试',
    fullDescription: '事务内锁定活动目录测试',
    cover: '/static/test.jpg',
    coverImage: '/static/test.jpg',
    covers: ['/static/test.jpg'],
    gallery: ['/static/test.jpg'],
    startDate: '2026-09-10',
    endDate: '2026-09-10',
    startTime: '10:00',
    endTime: '12:00',
    location: '测试地点',
    price: 0.01,
    originalPrice: 0.01,
    maxParticipants: 1,
    currentParticipants: 0,
    status: 'ongoing',
    category: '测试',
    tags: [],
    cardEligible: false,
    hostId: '',
    hostName: '',
    hostAvatar: '',
    hostDescription: '',
    venueName: '测试地点',
    venueDescription: '',
    venueImages: [],
    requirements: [],
    includes: [],
    refundPolicy: '',
    signups: [],
    createdAt: activityConfigurationVersion,
    updatedAt: activityConfigurationVersion,
    enabled: true,
    sort: 0,
  };
  await cleanupConnection.query(
    `INSERT INTO worker_house_activities
      (activity_id, enabled, sort_order, start_date, updated_at, payload)
     VALUES (?, 1, 0, ?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), sort_order = VALUES(sort_order),
       start_date = VALUES(start_date), updated_at = VALUES(updated_at), payload = VALUES(payload)`,
    [activityPayload.id, activityPayload.startDate, activityConfigurationVersion, JSON.stringify(activityPayload)],
  );

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
  const firstOrder = await orders.createShopOrderWithStock(shopInput, { stock: null });
  const duplicateOrders = await Promise.all([
    orders.createShopOrderWithStock({ ...shopInput, amount: 999 }, { stock: null }),
    orders.createShopOrderWithStock({ ...shopInput, amount: 500 }, { stock: null }),
  ]);
  assert.ok(duplicateOrders.every((item) => item.id === firstOrder.id));
  assert.ok(duplicateOrders.every((item) => item.amount === 1));

  const leaseClaims = await Promise.all([
    orders.claimOrderPaymentPreparation(firstOrder.id, 'mysql-lease-first', 10_000),
    orders.claimOrderPaymentPreparation(firstOrder.id, 'mysql-lease-second', 10_000),
  ]);
  assert.equal(leaseClaims.filter((item) => item.claimed).length, 1);

  // Simulate the route's product pre-read becoming stale before the transaction.
  // A retry must also reject changed config without mutating its saved amount.
  for (const patch of [
    { price: 0.02 }, { shippingFee: 0.01 }, { minQuantity: 2 }, { maxQuantity: 0 },
    { fulfillmentType: 'pickup' as const }, { fulfillmentLabel: '到店自取' },
    { unitLabel: '瓶' }, { enabled: false },
  ]) {
    await insertCatalogProduct(shopInput.productId, null, patch);
    await assert.rejects(
      orders.createShopOrderWithStock({ ...shopInput, id: 'WH_MYSQL_STALE_CONFIG' }, { stock: null }),
      (error: unknown) => orders.isShopStockConfigurationChangedError(error),
    );
    assert.equal(await orders.getOrderById('WH_MYSQL_STALE_CONFIG'), null);
    await assert.rejects(
      orders.claimOrderPaymentPreparation(firstOrder.id, 'stale-config-retry', 10_000),
      (error: unknown) => orders.isShopStockConfigurationChangedError(error),
    );
    const duplicate = await orders.createShopOrderWithStock({ ...shopInput, amount: 999 }, { stock: null });
    assert.equal(duplicate.amount, 1, 'idempotent creation must preserve the original price');
  }
  await insertCatalogProduct(shopInput.productId, null);
  const winningLeaseToken = leaseClaims[0].claimed ? 'mysql-lease-first' : 'mysql-lease-second';
  await orders.finishOrderPaymentPreparation(firstOrder.id, winningLeaseToken, {
    prepayId: 'mysql-existing-prepay', failureReason: '',
  });
  await insertCatalogProduct(shopInput.productId, null, { fulfillmentLabel: '履约方式已调整' });
  await assert.rejects(
    orders.claimOrderPaymentPreparation(firstOrder.id, 'cached-prepay-retry', 10_000),
    (error: unknown) => orders.isShopStockConfigurationChangedError(error),
  );
  assert.equal((await orders.getOrderById(firstOrder.id))?.prepayId, 'mysql-existing-prepay');
  await insertCatalogProduct(shopInput.productId, null);
  const cachedPreparation = await orders.claimOrderPaymentPreparation(firstOrder.id, 'valid-cached-retry', 10_000);
  assert.equal(cachedPreparation.claimed, false);
  assert.equal(cachedPreparation.order?.prepayId, 'mysql-existing-prepay');

  const buildStockOrder = (id: string, quantity: number) => ({
    ...shopInput,
    id,
    clientRequestId: `request-${id}`,
    productId: 'product-mysql-stock',
    quantity,
    amount: quantity,
    openid: `openid-${id}`,
  });
  const stockResults = await Promise.allSettled([
    orders.createShopOrderWithStock(buildStockOrder('WH_MYSQL_STOCK_FIRST', 2), { stock: 2 }),
    orders.createShopOrderWithStock(buildStockOrder('WH_MYSQL_STOCK_SECOND', 1), { stock: 2 }),
  ]);
  assert.equal(stockResults.filter((item) => item.status === 'fulfilled').length, 1);
  const stockRejected = stockResults.find((item) => item.status === 'rejected');
  assert.ok(stockRejected && stockRejected.status === 'rejected');
  assert.equal(orders.isShopStockExceededError(stockRejected.reason), true);

  const stockWinner = stockResults.find((item) => item.status === 'fulfilled');
  assert.ok(stockWinner && stockWinner.status === 'fulfilled');
  await orders.updateOrderStatus(stockWinner.value.id, 'closed', { failureReason: 'release stock' });
  const replacement = await orders.createShopOrderWithStock(
    buildStockOrder('WH_MYSQL_STOCK_REPLACEMENT', 2),
    { stock: 2 },
  );
  assert.equal(replacement.id, 'WH_MYSQL_STOCK_REPLACEMENT');
  await assert.rejects(
    orders.updateOrderStatus(stockWinner.value.id, 'paid', {
      transactionId: 'wx-late-after-stock-release',
    }),
    (error: unknown) => orders.isShopStockExceededError(error),
  );
  assert.equal((await orders.getOrderById(stockWinner.value.id))?.status, 'closed');

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
      { currentParticipants: 0, maxParticipants: 1, configurationVersion: activityConfigurationVersion },
    ),
    orders.createActivityOrderWithCapacity(
      buildActivityOrder('WA_MYSQL_LAST_SEAT_SECOND', 'openid-mysql-b'),
      { currentParticipants: 0, maxParticipants: 1, configurationVersion: activityConfigurationVersion },
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
    (error: unknown) => orders.isActivityCapacityConfigurationChangedError(error),
  );

  const activityWinner = activityResults.find((item) => item.status === 'fulfilled');
  assert.ok(activityWinner && activityWinner.status === 'fulfilled');
  await orders.updateOrderStatus(activityWinner.value.id, 'closed', { failureReason: 'release seat' });
  await orders.createActivityOrderWithCapacity(
    buildActivityOrder('WA_MYSQL_LATE_REPLACEMENT', 'openid-mysql-replacement'),
    { currentParticipants: 0, maxParticipants: 1, configurationVersion: activityConfigurationVersion },
  );
  await assert.rejects(
    orders.updateOrderStatus(activityWinner.value.id, 'paid', {
      activityCapacity: {
        currentParticipants: 0,
        maxParticipants: 1,
        configurationVersion: activityConfigurationVersion,
      },
      transactionId: 'wx-late-after-seat-release',
    }),
    (error: unknown) => orders.isActivityCapacityExceededError(error),
  );
  assert.equal((await orders.getOrderById(activityWinner.value.id))?.status, 'closed');
});
