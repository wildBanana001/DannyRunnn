import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type OrderStatus = 'pending' | 'paid' | 'failed';

export interface OrderRecord {
  id: string; // out_trade_no，商户订单号
  productId: string;
  productName: string;
  quantity: number;
  amount: number; // 支付金额，单位：分
  openid: string;
  remark: string;
  status: OrderStatus;
  mock: boolean; // 是否为 mock（未配置真实微信支付）订单
  prepayId: string;
  transactionId: string; // 微信支付订单号，回调时回填
  createdAt: string;
  updatedAt: string;
}

interface OrderStoreState {
  orders: OrderRecord[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'orders.store.json');

const store: OrderStoreState = {
  orders: [],
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function sanitizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeStatus(value: unknown): OrderStatus {
  return value === 'paid' || value === 'failed' ? value : 'pending';
}

function normalizeOrder(item: Partial<OrderRecord>): OrderRecord {
  return {
    id: sanitizeString(item.id),
    productId: sanitizeString(item.productId),
    productName: sanitizeString(item.productName),
    quantity: sanitizeNumber(item.quantity, 1),
    amount: sanitizeNumber(item.amount),
    openid: sanitizeString(item.openid),
    remark: sanitizeString(item.remark),
    status: sanitizeStatus(item.status),
    mock: Boolean(item.mock),
    prepayId: sanitizeString(item.prepayId),
    transactionId: sanitizeString(item.transactionId),
    createdAt: sanitizeString(item.createdAt) || now(),
    updatedAt: sanitizeString(item.updatedAt) || now(),
  };
}

function persistOrders() {
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(store.orders, null, 2), 'utf-8');
}

function loadOrders() {
  if (store.orders.length > 0) {
    return;
  }

  if (!existsSync(storageFilePath)) {
    store.orders = [];
    return;
  }

  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as OrderRecord[];
    store.orders = Array.isArray(parsed) ? parsed.map((item) => normalizeOrder(item)) : [];
  } catch (error) {
    console.error('[orders store] load error', error);
    store.orders = [];
  }
}

export interface CreateOrderInput {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  amount: number;
  openid: string;
  remark?: string;
  status?: OrderStatus;
  mock?: boolean;
  prepayId?: string;
}

export function createOrder(input: CreateOrderInput): OrderRecord {
  loadOrders();
  const record = normalizeOrder({
    ...input,
    remark: input.remark ?? '',
    status: input.status ?? 'pending',
    mock: input.mock ?? false,
    prepayId: input.prepayId ?? '',
    createdAt: now(),
    updatedAt: now(),
  });
  store.orders.unshift(record);
  persistOrders();
  return clone(record);
}

export function getOrderById(orderId: string): OrderRecord | null {
  loadOrders();
  const record = store.orders.find((item) => item.id === orderId) ?? null;
  return record ? clone(record) : null;
}

export function getOrdersByOpenid(openid: string): OrderRecord[] {
  loadOrders();
  const normalizedOpenid = sanitizeString(openid);
  if (!normalizedOpenid) return [];
  return clone(
    store.orders
      .filter((item) => item.openid === normalizedOpenid)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
  );
}

export function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  transactionId?: string,
): OrderRecord | null {
  loadOrders();
  const index = store.orders.findIndex((item) => item.id === orderId);
  if (index === -1) {
    return null;
  }

  const next: OrderRecord = {
    ...store.orders[index],
    status,
    transactionId: transactionId ? sanitizeString(transactionId) : store.orders[index].transactionId,
    updatedAt: now(),
  };
  store.orders[index] = next;
  persistOrders();
  return clone(next);
}
