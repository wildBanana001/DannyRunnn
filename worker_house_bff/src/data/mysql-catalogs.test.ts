import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  decodeMysqlActivityRow,
  decodeMysqlCatalogPayload,
  decodeMysqlProductRow,
} from './mysql-catalogs.js';
import {
  calculateShopOrderPricing,
  getShopProductQuantityIssue,
  normalizeShopProduct,
} from './shop.js';

test('decodes MySQL catalog JSON payloads from mysql2 return shapes', () => {
  const product = { id: 'product-001', price: 12.5 };
  for (const payload of [product, JSON.stringify(product), Buffer.from(JSON.stringify(product))]) {
    assert.deepEqual(decodeMysqlCatalogPayload(payload, 'product'), product);
  }
  assert.throws(() => decodeMysqlCatalogPayload([], 'product'), /payload 格式无效/);
});

test('rejects product payloads that drift from indexed MySQL columns', () => {
  const product = {
    id: 'product-indexed',
    name: '索引一致商品',
    category: '测试分类',
    price: 12.5,
    shippingFee: 0,
    minQuantity: 1,
    maxQuantity: 3,
    stock: 2,
    enabled: true,
  };
  const row = {
    product_id: product.id,
    enabled: 1,
    category: product.category,
    stock: 2,
    payload: product,
  };
  assert.equal(decodeMysqlProductRow(row as never).id, product.id);
  assert.throws(
    () => decodeMysqlProductRow({ ...row, product_id: 'different-id' } as never),
    /id 与索引列不一致/,
  );
  assert.throws(
    () => decodeMysqlProductRow({ ...row, enabled: 0 } as never),
    /enabled 与索引列不一致/,
  );
  assert.throws(
    () => decodeMysqlProductRow({ ...row, category: '其他分类' } as never),
    /category 与索引列不一致/,
  );
  assert.throws(
    () => decodeMysqlProductRow({ ...row, stock: 1 } as never),
    /stock 与索引列不一致/,
  );
});

test('rejects activity payloads that drift from indexed MySQL columns', () => {
  const activity = {
    id: 'activity-indexed',
    enabled: true,
    startDate: '2026-09-10',
    updatedAt: '2026-09-03T00:00:00.000Z',
    sort: 2,
  };
  const row = {
    activity_id: activity.id,
    enabled: 1,
    start_date: activity.startDate,
    updated_at: activity.updatedAt,
    sort_order: activity.sort,
    payload: activity,
  };
  assert.equal(decodeMysqlActivityRow(row as never).id, activity.id);
  assert.throws(
    () => decodeMysqlActivityRow({ ...row, activity_id: 'different-id' } as never),
    /id 与索引列不一致/,
  );
  assert.throws(
    () => decodeMysqlActivityRow({ ...row, enabled: 0 } as never),
    /enabled 与索引列不一致/,
  );
  assert.throws(
    () => decodeMysqlActivityRow({ ...row, start_date: '2026-09-11' } as never),
    /startDate 与索引列不一致/,
  );
  assert.throws(
    () => decodeMysqlActivityRow({ ...row, updated_at: '2026-09-04T00:00:00.000Z' } as never),
    /updatedAt 与索引列不一致/,
  );
  assert.throws(
    () => decodeMysqlActivityRow({ ...row, sort_order: 3 } as never),
    /sort 与索引列不一致/,
  );
});

test('normalizes server-owned quantity, stock and shipping constraints', () => {
  const defaults = normalizeShopProduct({ id: 'defaults', name: '默认商品', price: 1 });
  assert.equal(defaults.shippingFee, 0);
  assert.equal(defaults.minQuantity, 1);
  assert.equal(defaults.maxQuantity, 1);
  assert.equal(defaults.stock, 0);
  assert.equal(defaults.enabled, false);

  const constrained = normalizeShopProduct({
    id: 'constrained',
    name: '限购商品',
    price: 10,
    shippingFee: 3,
    minQuantity: 2,
    maxQuantity: 5,
    stock: 4,
    fulfillmentType: 'delivery',
    fulfillmentLabel: '快递配送',
    unitLabel: '件',
    enabled: true,
  });
  assert.equal(constrained.enabled, true);
  assert.match(getShopProductQuantityIssue(constrained, 1), /2-5/);
  assert.match(getShopProductQuantityIssue(constrained, 5), /库存不足/);
  assert.equal(getShopProductQuantityIssue(constrained, 4), '');
  assert.deepEqual(calculateShopOrderPricing(constrained, 4), {
    amount: 4_300,
    shippingFee: 300,
    unitPrice: 1_000,
  });

  const explicitUnlimited = normalizeShopProduct({
    ...constrained,
    id: 'explicit-unlimited',
    stock: null,
  });
  assert.equal(explicitUnlimited.enabled, true);
  assert.equal(explicitUnlimited.stock, null);
});

test('fails closed when any sale-critical product field is missing or malformed', () => {
  const validProduct = {
    id: 'strict-product',
    name: '严格商品',
    price: 10,
    shippingFee: 0,
    minQuantity: 1,
    maxQuantity: 3,
    stock: 2,
    fulfillmentType: 'delivery' as const,
    fulfillmentLabel: '快递配送',
    unitLabel: '件',
    enabled: true,
  };
  const invalidProducts = [
    { ...validProduct, enabled: undefined },
    { ...validProduct, price: undefined },
    { ...validProduct, price: Number.NaN },
    { ...validProduct, price: 0.001 },
    { ...validProduct, shippingFee: undefined },
    { ...validProduct, shippingFee: 0.001 },
    { ...validProduct, minQuantity: undefined },
    { ...validProduct, maxQuantity: 0 },
    { ...validProduct, maxQuantity: 1, minQuantity: 2 },
    { ...validProduct, stock: undefined },
    { ...validProduct, stock: 1.5 },
    { ...validProduct, fulfillmentType: undefined },
    { ...validProduct, fulfillmentType: 'unknown' },
    { ...validProduct, fulfillmentLabel: '' },
    { ...validProduct, unitLabel: '' },
  ];

  for (const product of invalidProducts) {
    assert.equal(
      normalizeShopProduct(product as unknown as Parameters<typeof normalizeShopProduct>[0]).enabled,
      false,
    );
  }

  const malformedStock = normalizeShopProduct({
    ...validProduct,
    stock: 'invalid',
  } as unknown as Parameters<typeof normalizeShopProduct>[0]);
  assert.equal(malformedStock.enabled, false);
  assert.equal(malformedStock.stock, 0);
});

test('ships catalog tables, indexes and one-time seed state in migration SQL', () => {
  const migration = readFileSync(new URL('../../sql/002_mysql_catalog_storage.sql', import.meta.url), 'utf8');
  assert.match(migration, /worker_house_activities/);
  assert.match(migration, /worker_house_shop_products/);
  assert.match(migration, /worker_house_catalog_state/);
  assert.match(migration, /payload JSON NOT NULL/);
  assert.match(migration, /idx_activities_enabled_start/);
  assert.match(migration, /idx_products_enabled_sort/);
});

test('bundled activity seed contains only remotely reachable dinner-table assets', () => {
  const seed = readFileSync(new URL('./activities.store.json', import.meta.url), 'utf8');
  assert.doesNotMatch(seed, /activity-asset:\/\//);
  assert.match(seed, /\/static\/images\/activities\/dinner-table\/cover\.jpg/);
});
