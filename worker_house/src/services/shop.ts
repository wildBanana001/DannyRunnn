import Taro from '@tarojs/taro';
import { REAL_PAYMENT_TEST_PRICE_YUAN } from '../constants/runtime';
import type { Address } from './address';
import { getPaymentApiMode, requestWithMode, type RequestOptions } from './request';

export type ShopOrderStatus = 'pending' | 'paid' | 'failed' | 'closed';
export type ShopFulfillmentType = 'delivery' | 'pickup' | 'onsite';

export interface ShopProduct {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  description: string;
  tags: string[];
  category: string;
  fulfillmentType: ShopFulfillmentType;
  fulfillmentLabel: string;
  unitLabel: string;
  alcoholic: boolean;
  abv: number;
  volumeMl: number;
  enabled: boolean;
}

export interface ShopAddressSnapshot {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
}

export interface ShopOrder {
  id: string;
  clientRequestId: string;
  productId: string;
  productName: string;
  productImageUrl: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  address: ShopAddressSnapshot | null;
  fulfillmentType: ShopFulfillmentType;
  fulfillmentLabel: string;
  unitLabel: string;
  remark: string;
  status: ShopOrderStatus;
  mock: boolean;
  transactionId: string;
  paidAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}

export interface ShopPaymentSession {
  outTradeNo: string;
  amount: number;
  status: ShopOrderStatus;
  mock: boolean;
  payment?: ShopPayParams;
}

export interface StartShopPaymentInput {
  productId: string;
  quantity: number;
  address?: Address | ShopAddressSnapshot | null;
  remark?: string;
  clientRequestId: string;
}

const MOCK_PRODUCTS: ShopProduct[] = [
  { id: 'cocktail-afterwork-sour', name: '下班快乐威士忌酸', price: REAL_PAYMENT_TEST_PRICE_YUAN, originalPrice: 49, imageUrl: '', description: '威士忌与新鲜柠檬的明亮酸甜，给忙碌一天一个轻松收尾。', tags: ['威士忌', '酸甜', '到店享用'], category: 'cocktail', fulfillmentType: 'onsite', fulfillmentLabel: '到店享用', unitLabel: '杯', alcoholic: true, abv: 14, volumeMl: 180, enabled: true },
  { id: 'cocktail-mint-mojito', name: '薄荷青柠莫吉托', price: REAL_PAYMENT_TEST_PRICE_YUAN, originalPrice: 45, imageUrl: '', description: '清新薄荷、青柠与气泡交织，入口轻盈，适合慢慢放松。', tags: ['朗姆酒', '清爽', '到店享用'], category: 'cocktail', fulfillmentType: 'onsite', fulfillmentLabel: '到店享用', unitLabel: '杯', alcoholic: true, abv: 10, volumeMl: 300, enabled: true },
  { id: 'cocktail-berry-fizz', name: '莓果微醺气泡', price: REAL_PAYMENT_TEST_PRICE_YUAN, originalPrice: 52, imageUrl: '', description: '酸甜莓果搭配细腻气泡，果香饱满，口感轻快。', tags: ['莓果', '气泡', '到店享用'], category: 'cocktail', fulfillmentType: 'onsite', fulfillmentLabel: '到店享用', unitLabel: '杯', alcoholic: true, abv: 8, volumeMl: 300, enabled: true },
  { id: 'cocktail-sunset-highball', name: '落日柑橘嗨棒', price: REAL_PAYMENT_TEST_PRICE_YUAN, originalPrice: 48, imageUrl: '', description: '清爽嗨棒融入柑橘香气，像落日一样明亮又温柔。', tags: ['嗨棒', '柑橘', '到店享用'], category: 'cocktail', fulfillmentType: 'onsite', fulfillmentLabel: '到店享用', unitLabel: '杯', alcoholic: true, abv: 9, volumeMl: 320, enabled: true },
  { id: 'cocktail-espresso-martini', name: '浓缩咖啡马天尼', price: REAL_PAYMENT_TEST_PRICE_YUAN, originalPrice: 56, imageUrl: '', description: '浓缩咖啡的醇苦与酒香平衡，绵密泡沫带来顺滑尾韵。', tags: ['咖啡', '醇香', '到店享用'], category: 'cocktail', fulfillmentType: 'onsite', fulfillmentLabel: '到店享用', unitLabel: '杯', alcoholic: true, abv: 16, volumeMl: 180, enabled: true },
  { id: 'cocktail-elderflower-zero', name: '接骨木花零度特调', price: REAL_PAYMENT_TEST_PRICE_YUAN, originalPrice: 39, imageUrl: '', description: '接骨木花、青柠与气泡水调出的无酒精花香特饮，清爽无负担。', tags: ['无酒精', '花香', '到店享用'], category: 'cocktail', fulfillmentType: 'onsite', fulfillmentLabel: '到店享用', unitLabel: '杯', alcoholic: false, abv: 0, volumeMl: 300, enabled: true },
];

const MOCK_ORDER_STORAGE_KEY = 'worker-house-mock-shop-orders-v2';
const REAL_PAYMENT_ONLY_MESSAGE = '当前仅支持在微信小程序中进行真实支付测试';
const MOCK_PAYMENT_REJECTED_MESSAGE = '支付服务仍处于模拟模式，请先部署真实微信支付配置';

function shopRequest<T>(options: RequestOptions) {
  return requestWithMode<T>(getPaymentApiMode(), options);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeAddress(address: Address | ShopAddressSnapshot): ShopAddressSnapshot {
  return {
    name: address.name.trim(),
    phone: address.phone.trim(),
    province: address.province.trim(),
    city: address.city.trim(),
    district: address.district.trim(),
    detail: address.detail.trim(),
  };
}

function resolveAssetUrl(imageUrl: string): string {
  if (!imageUrl || /^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  const explicitBase = process.env.TARO_APP_SHOP_ASSET_BASE_URL?.trim();
  const bffBase = getPaymentApiMode() === 'bff' ? process.env.TARO_APP_BFF_BASE_URL?.trim() : '';
  const base = (explicitBase || bffBase || '').replace(/\/$/, '');
  const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return base ? `${base}${path}` : '';
}

function normalizeProduct(product: ShopProduct): ShopProduct {
  return {
    ...product,
    category: product.category?.trim() || 'general',
    fulfillmentType: product.fulfillmentType === 'onsite' || product.fulfillmentType === 'pickup' ? product.fulfillmentType : 'delivery',
    fulfillmentLabel: product.fulfillmentLabel?.trim() || (product.fulfillmentType === 'onsite' ? '到店享用' : product.fulfillmentType === 'pickup' ? '到店自取' : '快递配送'),
    unitLabel: product.unitLabel?.trim() || '件',
    alcoholic: Boolean(product.alcoholic),
    abv: Math.max(0, Number(product.abv) || 0),
    volumeMl: Math.max(0, Number(product.volumeMl) || 0),
    enabled: product.enabled !== false,
    imageUrl: resolveAssetUrl(product.imageUrl),
  };
}

function normalizeOrder(order: ShopOrder): ShopOrder {
  return {
    ...order,
    address: order.address || null,
    fulfillmentType: order.fulfillmentType === 'onsite' || order.fulfillmentType === 'pickup' ? order.fulfillmentType : 'delivery',
    fulfillmentLabel: order.fulfillmentLabel?.trim() || (order.fulfillmentType === 'onsite' ? '到店享用' : order.fulfillmentType === 'pickup' ? '到店自取' : '快递配送'),
    unitLabel: order.unitLabel?.trim() || '件',
    productImageUrl: resolveAssetUrl(order.productImageUrl),
  };
}

function getMockOrders(): ShopOrder[] {
  const cached = Taro.getStorageSync<ShopOrder[] | null>(MOCK_ORDER_STORAGE_KEY);
  return Array.isArray(cached) ? cached.map(normalizeOrder) : [];
}

function assertRealPaymentRuntime() {
  if (getPaymentApiMode() === 'mock') {
    throw new Error(REAL_PAYMENT_ONLY_MESSAGE);
  }
}

function assertRealPaymentSession(session: ShopPaymentSession): ShopPaymentSession {
  if (session.mock) {
    throw new Error(MOCK_PAYMENT_REJECTED_MESSAGE);
  }
  return session;
}

export function createShopClientRequestId(): string {
  return `shop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isPaymentCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String((error as { errMsg?: unknown })?.errMsg || error || '');
  return message.toLowerCase().includes('cancel');
}

export async function fetchShopProducts(): Promise<ShopProduct[]> {
  if (getPaymentApiMode() === 'mock') {
    return clone(MOCK_PRODUCTS);
  }

  const result = await shopRequest<{ list: ShopProduct[] }>({ path: '/api/shop/products' });
  return (result.list || []).map(normalizeProduct);
}

export async function fetchShopProduct(productId: string): Promise<ShopProduct> {
  if (getPaymentApiMode() === 'mock') {
    const product = MOCK_PRODUCTS.find((item) => item.id === productId);
    if (!product) {
      throw new Error('商品不存在');
    }
    return clone(product);
  }

  const result = await shopRequest<ShopProduct>({ path: `/api/shop/products/${encodeURIComponent(productId)}` });
  return normalizeProduct(result);
}

export async function startShopPayment(input: StartShopPaymentInput): Promise<ShopPaymentSession> {
  assertRealPaymentRuntime();

  const data = {
    productId: input.productId,
    quantity: input.quantity,
    remark: input.remark?.trim() || '',
    clientRequestId: input.clientRequestId,
    ...(input.address ? { address: normalizeAddress(input.address) } : {}),
  };

  const session = await shopRequest<ShopPaymentSession>({
    data,
    method: 'POST',
    path: '/api/shop/orders/pay',
  });
  return assertRealPaymentSession(session);
}

export async function retryShopPayment(orderId: string): Promise<ShopPaymentSession> {
  assertRealPaymentRuntime();

  const session = await shopRequest<ShopPaymentSession>({
    method: 'POST',
    path: `/api/shop/orders/${encodeURIComponent(orderId)}/retry`,
  });
  return assertRealPaymentSession(session);
}

export async function launchShopPayment(session: ShopPaymentSession): Promise<void> {
  assertRealPaymentSession(session);
  if (session.amount <= 0 || session.status === 'paid') {
    return;
  }
  if (!session.payment) {
    throw new Error('支付参数缺失，请重新下单');
  }

  await Taro.requestPayment(session.payment);
}

export async function fetchShopOrder(orderId: string): Promise<ShopOrder> {
  if (getPaymentApiMode() === 'mock') {
    const order = getMockOrders().find((item) => item.id === orderId);
    if (!order) {
      throw new Error('订单不存在');
    }
    return clone(order);
  }

  const result = await shopRequest<ShopOrder>({ path: `/api/shop/orders/${encodeURIComponent(orderId)}` });
  return normalizeOrder(result);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function confirmShopPayment(orderId: string): Promise<ShopOrder> {
  const retryDelays = [0, 800, 1600];
  let order: ShopOrder | null = null;

  for (const delay of retryDelays) {
    if (delay > 0) await wait(delay);
    order = await fetchShopOrder(orderId);
    if (order.status !== 'pending') return order;
  }

  if (!order) throw new Error('支付结果查询失败');
  return order;
}

export async function fetchMyShopOrders(): Promise<ShopOrder[]> {
  if (getPaymentApiMode() === 'mock') {
    return clone(getMockOrders());
  }

  const result = await shopRequest<{ list: ShopOrder[] }>({ path: '/api/shop/orders/mine' });
  return (result.list || []).map(normalizeOrder);
}
