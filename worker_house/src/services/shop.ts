import Taro from '@tarojs/taro';
import type { Address } from './address';
import { getPaymentApiMode, requestWithMode, type RequestOptions } from './request';

export type ShopOrderStatus = 'pending' | 'paid' | 'failed' | 'closed';

export interface ShopProduct {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  description: string;
  stock: number;
  tags: string[];
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
  address: ShopAddressSnapshot;
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
  address: Address | ShopAddressSnapshot;
  remark?: string;
  clientRequestId: string;
}

const MOCK_PRODUCTS: ShopProduct[] = [
  { id: 'prod-coffee-box', name: '社畜续命挂耳咖啡礼盒', price: 59.9, originalPrice: 89, imageUrl: '', description: '打工人早八续命必备，10 包精品挂耳，一口回魂，续航一整天。', stock: 200, tags: ['续命', '咖啡', '热销'] },
  { id: 'prod-fish-tote', name: '摸鱼快乐屋帆布袋', price: 39, originalPrice: 59, imageUrl: '', description: '加厚帆布，容量超大，装下电脑也装得下摸鱼的心，通勤上班一包搞定。', stock: 150, tags: ['帆布袋', '通勤', '摸鱼'] },
  { id: 'prod-stress-ball', name: '打工人解压捏捏乐', price: 19.9, originalPrice: 29.9, imageUrl: '', description: '开会想爆炸？捏它。需求又改了？捏它。软糯回弹，解压第一名。', stock: 300, tags: ['解压', '办公桌面'] },
  { id: 'prod-thermos-cup', name: '早八人保命保温杯', price: 69, originalPrice: 99, imageUrl: '', description: '316 不锈钢内胆，12 小时长效保温，养生朋克的枸杞就靠它了。', stock: 120, tags: ['保温杯', '养生', '早八'] },
  { id: 'prod-monday-stickers', name: '周一不上班主题贴纸包', price: 12.9, originalPrice: 19.9, imageUrl: '', description: '30 张防水贴纸，把不想上班的心情贴在电脑、水杯和工牌上。', stock: 500, tags: ['贴纸', '周边', '低价'] },
  { id: 'prod-off-work-slippers', name: '社畜下班快乐拖鞋', price: 45, originalPrice: 69, imageUrl: '', description: '轻软 EVA 鞋底，回家第一件事就是换上它，宣告今天的班上完了。', stock: 180, tags: ['拖鞋', '居家', '解放双脚'] },
];

const MOCK_ORDER_STORAGE_KEY = 'worker-house-mock-shop-orders-v2';

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
    imageUrl: resolveAssetUrl(product.imageUrl),
  };
}

function normalizeOrder(order: ShopOrder): ShopOrder {
  return {
    ...order,
    productImageUrl: resolveAssetUrl(order.productImageUrl),
  };
}

function getMockOrders(): ShopOrder[] {
  const cached = Taro.getStorageSync<ShopOrder[] | null>(MOCK_ORDER_STORAGE_KEY);
  return Array.isArray(cached) ? cached : [];
}

function saveMockOrders(orders: ShopOrder[]) {
  Taro.setStorageSync(MOCK_ORDER_STORAGE_KEY, orders);
}

function createMockPayment(input: StartShopPaymentInput): ShopPaymentSession {
  const product = MOCK_PRODUCTS.find((item) => item.id === input.productId);
  if (!product) {
    throw new Error('商品不存在');
  }

  const quantity = Math.max(1, Math.min(product.stock, Math.floor(input.quantity || 1)));
  const address = normalizeAddress(input.address);
  if (!address.name || !address.phone || !address.detail) {
    throw new Error('请先填写完整收货地址');
  }

  const orders = getMockOrders();
  const existing = orders.find((item) => item.clientRequestId === input.clientRequestId);
  if (existing) {
    return {
      outTradeNo: existing.id,
      amount: existing.amount,
      status: existing.status,
      mock: true,
    };
  }

  const timestamp = new Date().toISOString();
  const outTradeNo = `MOCK${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const order: ShopOrder = {
    id: outTradeNo,
    clientRequestId: input.clientRequestId,
    productId: product.id,
    productName: product.name,
    productImageUrl: product.imageUrl,
    unitPrice: Math.round(product.price * 100),
    quantity,
    amount: Math.round(product.price * 100) * quantity,
    address,
    remark: input.remark?.trim() || '',
    status: 'paid',
    mock: true,
    transactionId: `MOCK_TX_${Date.now()}`,
    paidAt: timestamp,
    expiresAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  saveMockOrders([order, ...orders]);

  return {
    outTradeNo,
    amount: order.amount,
    status: 'paid',
    mock: true,
  };
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
  if (getPaymentApiMode() === 'mock') {
    return createMockPayment(input);
  }

  return shopRequest<ShopPaymentSession>({
    data: {
      productId: input.productId,
      quantity: input.quantity,
      address: normalizeAddress(input.address),
      remark: input.remark?.trim() || '',
      clientRequestId: input.clientRequestId,
    },
    method: 'POST',
    path: '/api/shop/orders/pay',
  });
}

export async function retryShopPayment(orderId: string): Promise<ShopPaymentSession> {
  if (getPaymentApiMode() === 'mock') {
    const order = getMockOrders().find((item) => item.id === orderId);
    if (!order) {
      throw new Error('订单不存在');
    }
    return { outTradeNo: order.id, amount: order.amount, status: order.status, mock: true };
  }

  return shopRequest<ShopPaymentSession>({
    method: 'POST',
    path: `/api/shop/orders/${encodeURIComponent(orderId)}/retry`,
  });
}

export async function launchShopPayment(session: ShopPaymentSession): Promise<void> {
  if (session.mock || session.status === 'paid') {
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
