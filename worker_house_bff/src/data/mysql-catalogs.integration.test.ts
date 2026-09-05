import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import test from 'node:test';
import type { ActivityRecord } from '../types/index.js';

const testUrl = process.env.MYSQL_TEST_URL?.trim() || '';

function assertDedicatedTestDatabase(connectionUrl: string) {
  const databaseName = decodeURIComponent(new URL(connectionUrl).pathname.replace(/^\//, ''));
  assert.match(
    databaseName,
    /(?:^|[_-])test(?:$|[_-])/i,
    'MYSQL_TEST_URL 必须指向名称包含 test 的独立测试数据库',
  );
}

test('requires MYSQL_TEST_URL to name an explicit test database', () => {
  assert.throws(
    () => assertDedicatedTestDatabase('mysql://user:pass@127.0.0.1/worker_house'),
    /独立测试数据库/,
  );
  assert.throws(
    () => assertDedicatedTestDatabase('mysql://user:pass@127.0.0.1/contest'),
    /独立测试数据库/,
  );
  assert.doesNotThrow(
    () => assertDedicatedTestDatabase('mysql://user:pass@127.0.0.1/worker_house_test'),
  );
});

test('seeds MySQL catalogs once and persists activity CRUD plus product reads', {
  skip: !testUrl,
}, async (context) => {
  assertDedicatedTestDatabase(testUrl);
  process.env.MODE = 'cloudrun';
  process.env.SHOP_ORDER_STORAGE = 'mysql';
  process.env.MYSQL_URL = testUrl;
  process.env.MYSQL_AUTO_MIGRATE = 'true';

  const mysqlOrders = await import('./mysql-orders.js');
  const catalogs = await import('./mysql-catalogs.js');
  const { normalizeShopProduct } = await import('./shop.js');
  context.after(() => mysqlOrders.closeMysqlOrderStorage());
  await catalogs.migrateMysqlCatalogStorage();

  const cleanupConnection = await mysql.createConnection(testUrl);
  context.after(async () => {
    try {
      await cleanupConnection.query("DELETE FROM worker_house_catalog_state WHERE catalog_name IN ('activities', 'products')");
      await cleanupConnection.query(
        'DELETE FROM worker_house_activities WHERE activity_id = ?',
        ['act-catalog-integration'],
      );
      await cleanupConnection.query(
        'DELETE FROM worker_house_shop_products WHERE product_id = ?',
        ['product-catalog-integration'],
      );
    } finally {
      await cleanupConnection.end();
    }
  });
  await cleanupConnection.query("DELETE FROM worker_house_catalog_state WHERE catalog_name IN ('activities', 'products')");
  await cleanupConnection.query(
    'DELETE FROM worker_house_activities WHERE activity_id = ?',
    ['act-catalog-integration'],
  );
  await cleanupConnection.query(
    'DELETE FROM worker_house_shop_products WHERE product_id = ?',
    ['product-catalog-integration'],
  );

  const activity: ActivityRecord = {
    id: 'act-catalog-integration',
    title: 'MySQL 活动目录测试',
    description: '测试活动',
    fullDescription: '测试活动详情',
    cover: '/static/test.jpg',
    coverImage: '/static/test.jpg',
    covers: ['/static/test.jpg'],
    gallery: [],
    startDate: '2026-09-10',
    endDate: '2026-09-10',
    startTime: '10:00',
    endTime: '12:00',
    location: '测试地点',
    price: 12,
    originalPrice: 12,
    maxParticipants: 10,
    currentParticipants: 0,
    status: 'ongoing',
    category: '测试',
    tags: [],
    cardEligible: false,
    hostId: 'host-test',
    hostName: '测试主理人',
    hostAvatar: '',
    hostDescription: '',
    venueName: '测试场地',
    venueDescription: '',
    venueImages: [],
    requirements: [],
    includes: [],
    refundPolicy: '',
    signups: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    enabled: true,
    sort: 1,
  };
  const product = normalizeShopProduct({
    id: 'product-catalog-integration',
    name: 'MySQL 商品目录测试',
    price: 8,
    originalPrice: 10,
    shippingFee: 2,
    minQuantity: 1,
    maxQuantity: 3,
    stock: 2,
    fulfillmentType: 'delivery',
    fulfillmentLabel: '快递配送',
    unitLabel: '件',
    enabled: true,
  });

  assert.equal(
    (await catalogs.initializeMysqlActivityCatalog([activity])).some((item) => item.id === activity.id),
    true,
  );
  assert.equal(
    (await catalogs.initializeMysqlProductCatalog([product])).some((item) => item.id === product.id),
    true,
  );
  assert.equal((await catalogs.getMysqlActivityById(activity.id))?.title, activity.title);
  assert.equal((await catalogs.getMysqlProductById(product.id))?.shippingFee, 2);

  await catalogs.upsertMysqlActivity({ ...activity, title: 'MySQL 活动已更新' });
  assert.equal((await catalogs.getMysqlActivityById(activity.id))?.title, 'MySQL 活动已更新');
  assert.equal(await catalogs.deleteMysqlActivity(activity.id), true);
  assert.equal(await catalogs.getMysqlActivityById(activity.id), null);

  // Deleting the seeded record must not replay the bundled seed on a later process startup.
  await catalogs.initializeMysqlActivityCatalog([activity]);
  assert.equal(await catalogs.getMysqlActivityById(activity.id), null);
});
