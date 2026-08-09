import Taro from '@tarojs/taro';
import type { Address } from './address';
import { cloudrunBinaryRequest } from './cloudrun';
import { getApiMode, getPaymentApiMode, requestWithMode, type ApiMode, type RequestOptions } from './request';

export type ShopOrderStatus = 'pending' | 'paid' | 'failed' | 'closed';
export type ShopFulfillmentType = 'delivery' | 'pickup' | 'onsite';
export type ShopFulfillmentStatus = 'pending' | 'fulfilled';
export type WechatShippingStatus = 'not_required' | 'pending' | 'reporting' | 'reported' | 'failed';

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
  fulfillmentStatus: ShopFulfillmentStatus;
  fulfilledAt: string;
  wechatShippingStatus: WechatShippingStatus;
  wechatShippingReportedAt: string;
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

const MOCK_ORDER_STORAGE_KEY = 'worker-house-mock-shop-orders-v2';
const REAL_PAYMENT_ONLY_MESSAGE = '当前仅支持在微信小程序中使用微信支付';
const MOCK_PAYMENT_REJECTED_MESSAGE = '支付服务仍处于模拟模式，请先部署真实微信支付配置';
const shopImageCache = new Map<string, Promise<string>>();

function getShopApiMode(): ApiMode {
  const paymentMode = getPaymentApiMode();
  return paymentMode === 'mock' ? getApiMode() : paymentMode;
}

function shopRequest<T>(options: RequestOptions) {
  return requestWithMode<T>(getShopApiMode(), options);
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
  if (!imageUrl || /^(?:https?:|cloud:|wxfile:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }

  const explicitBase = process.env.TARO_APP_SHOP_ASSET_BASE_URL?.trim();
  const bffBase = getShopApiMode() === 'bff' ? process.env.TARO_APP_BFF_BASE_URL?.trim() : '';
  const base = (explicitBase || bffBase || '').replace(/\/$/, '');
  const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return base ? `${base}${path}` : '';
}

export function resolveShopProductImageUrl(imageUrl: string): string {
  return resolveAssetUrl(imageUrl?.trim() || '');
}

function hashShopImagePath(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getShopImageExtension(imageUrl: string) {
  const pathname = imageUrl.split(/[?#]/, 1)[0].toLowerCase();
  const extension = pathname.match(/\.(?:jpe?g|png|webp|gif)$/)?.[0];
  return extension || '.jpg';
}

function writeShopImageFile(imageUrl: string, data: ArrayBuffer) {
  const filePath = `${Taro.env.USER_DATA_PATH}/worker-house-shop-${hashShopImagePath(imageUrl)}${getShopImageExtension(imageUrl)}`;
  return new Promise<string>((resolve, reject) => {
    Taro.getFileSystemManager().writeFile({
      data,
      fail: reject,
      filePath,
      success: () => resolve(filePath),
    });
  });
}

export async function loadShopProductImage(imageUrl: string): Promise<string> {
  const normalizedUrl = imageUrl?.trim() || '';
  const directlyUsableUrl = resolveShopProductImageUrl(normalizedUrl);
  if (directlyUsableUrl || !normalizedUrl) {
    return directlyUsableUrl;
  }

  const cloudrunPath = normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`;
  const resourcePath = cloudrunPath.split(/[?#]/, 1)[0];
  if (
    process.env.TARO_ENV !== 'weapp'
    || getShopApiMode() !== 'cloudrun'
    || !resourcePath.startsWith('/static/images/shop/')
    || resourcePath.includes('..')
  ) {
    return '';
  }

  const cached = shopImageCache.get(normalizedUrl);
  if (cached) return cached;

  const pending = cloudrunBinaryRequest(cloudrunPath)
    .then((data) => writeShopImageFile(normalizedUrl, data))
    .catch((error) => {
      shopImageCache.delete(normalizedUrl);
      throw error;
    });
  shopImageCache.set(normalizedUrl, pending);
  return pending;
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
    imageUrl: product.imageUrl?.trim() || '',
  };
}

function normalizeOrder(order: ShopOrder): ShopOrder {
  const fulfillmentStatus = order.fulfillmentStatus === 'fulfilled' ? 'fulfilled' : 'pending';
  const wechatShippingStatus = ['pending', 'reporting', 'reported', 'failed'].includes(order.wechatShippingStatus)
    ? order.wechatShippingStatus
    : 'not_required';
  return {
    ...order,
    address: order.address || null,
    fulfillmentType: order.fulfillmentType === 'onsite' || order.fulfillmentType === 'pickup' ? order.fulfillmentType : 'delivery',
    fulfillmentLabel: order.fulfillmentLabel?.trim() || (order.fulfillmentType === 'onsite' ? '到店享用' : order.fulfillmentType === 'pickup' ? '到店自取' : '快递配送'),
    fulfillmentStatus,
    fulfilledAt: order.fulfilledAt || '',
    wechatShippingStatus,
    wechatShippingReportedAt: order.wechatShippingReportedAt || '',
    unitLabel: order.unitLabel?.trim() || '件',
    productImageUrl: order.productImageUrl?.trim() || '',
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
  const result = await shopRequest<{ list: ShopProduct[] }>({ path: '/api/shop/products' });
  return (result.list || []).map(normalizeProduct);
}

export async function fetchShopProduct(productId: string): Promise<ShopProduct> {
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
