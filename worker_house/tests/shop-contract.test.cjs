const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  calculateShopOrderPricing,
  clampShopQuantity,
  getShopProductQuantityIssue,
  getShopQuantityBounds,
  normalizeShopProductPayload,
} = require('../src/services/shop-contract.js');

const projectRoot = path.resolve(__dirname, '..');
const readSource = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const createProduct = (overrides = {}) => normalizeShopProductPayload({
  id: 'product-test',
  name: '测试商品',
  price: 12.34,
  shippingFee: 3.5,
  minQuantity: 2,
  maxQuantity: 5,
  stock: 4,
  fulfillmentType: 'delivery',
  fulfillmentLabel: '快递配送',
  unitLabel: '件',
  enabled: true,
  ...overrides,
});

test('strictly normalizes server product constraints and never enables a missing flag', () => {
  const missingEnabled = normalizeShopProductPayload({
    id: 'missing-enabled',
    name: '缺少状态',
    price: 1,
  });
  assert.equal(missingEnabled.enabled, false);
  assert.equal(missingEnabled.shippingFee, 0);
  assert.equal(missingEnabled.minQuantity, 1);
  assert.equal(missingEnabled.maxQuantity, 1);
  assert.equal(missingEnabled.stock, 0);
  assert.equal(createProduct({ price: null }).enabled, false);
  assert.equal(createProduct({ price: '   ' }).enabled, false);
  assert.equal(createProduct({ price: 0.001 }).enabled, false);
  assert.equal(createProduct({ shippingFee: undefined }).enabled, false);
  assert.equal(createProduct({ minQuantity: undefined }).enabled, false);
  assert.equal(createProduct({ maxQuantity: 1, minQuantity: 2 }).enabled, false);
  assert.equal(createProduct({ stock: undefined }).enabled, false);
  assert.equal(createProduct({ fulfillmentType: undefined }).enabled, false);
  assert.equal(createProduct({ fulfillmentType: 'unknown' }).enabled, false);
  assert.equal(createProduct({ fulfillmentLabel: '' }).enabled, false);
  assert.equal(createProduct({ unitLabel: '' }).enabled, false);

  const normalized = createProduct();
  assert.equal(normalized.enabled, true);
  assert.equal(normalized.price, 12.34);
  assert.equal(normalized.shippingFee, 3.5);
  assert.equal(normalized.minQuantity, 2);
  assert.equal(normalized.maxQuantity, 5);
  assert.equal(normalized.stock, 4);

  assert.equal(createProduct({ price: '12.34' }).enabled, false);
  assert.equal(createProduct({ minQuantity: '2' }).enabled, false);
  assert.equal(createProduct({ stock: '4' }).enabled, false);

  const malformedStock = createProduct({ stock: 'not-a-number' });
  assert.equal(malformedStock.stock, 0);
  assert.equal(getShopQuantityBounds(malformedStock).canPurchase, false);
});

test('quantity bounds honor minimum, maximum and stock', () => {
  const product = createProduct();
  assert.deepEqual(getShopQuantityBounds(product), {
    minQuantity: 2,
    maxQuantity: 4,
    canPurchase: true,
  });
  assert.equal(clampShopQuantity(product, 1), 2);
  assert.equal(clampShopQuantity(product, 99), 4);
  assert.equal(getShopProductQuantityIssue(product, 4), '');
  assert.match(getShopProductQuantityIssue(product, 5), /库存不足/);

  const soldOut = createProduct({ stock: 0 });
  assert.equal(getShopQuantityBounds(soldOut).canPurchase, false);
  assert.match(getShopProductQuantityIssue(soldOut, 2), /库存不足/);
});

test('order pricing includes the server shipping fee in cents', () => {
  assert.deepEqual(calculateShopOrderPricing(createProduct(), 2), {
    unitPrice: 1234,
    subtotal: 2468,
    shippingFee: 350,
    amount: 2818,
  });
});

test('shop pages consume the shared quantity and pricing contract', () => {
  const service = readSource('src/services/shop.ts');
  const productDetail = readSource('src/pages/shop/product-detail/index.tsx');
  const orderConfirm = readSource('src/pages/shop/order-confirm/index.tsx');
  const orderDetail = readSource('src/pages/shop/order-detail/index.tsx');

  assert.match(service, /shippingFee: number/);
  assert.doesNotMatch(service, /enabled:\s*product\.enabled !== false/);
  assert.match(productDetail, /clampShopQuantity/);
  assert.match(productDetail, /getShopQuantityBounds/);
  assert.match(orderConfirm, /session\.productId !== product\.id/);
  assert.match(orderConfirm, /session\.amount !== pricing\.amount/);
  assert.match(orderConfirm, /session\.shippingFee !== pricing\.shippingFee/);
  assert.match(orderConfirm, /商品小计/);
  assert.match(orderConfirm, /配送费/);
  assert.match(orderDetail, /order\.shippingFee/);
});
