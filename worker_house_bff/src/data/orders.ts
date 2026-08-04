import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import {
  AccountOrderDeletionBlockedError,
  ActivityCapacityExceededError,
  anonymizeOrderForAccountDeletion,
  buildNewOrderRecord,
  cloneOrder,
  createAnonymizedOrderOpenid,
  hasActivePaymentPreparation,
  hasActiveWechatShippingReport,
  isAccountDeletionBlockingOrder,
  isActiveActivityOrder,
  normalizeOrder,
  nowIso,
  sanitizeOrderNumber,
  sanitizeOrderString,
  shouldRetainOrderAfterAccountDeletion,
  type AccountOrderDeletionResult,
  type ActivityOrderCapacity,
  type CreateOrderInput,
  type FulfillmentReportClaim,
  type OrderKind,
  type OrderRecord,
  type OrderStatus,
  type PaymentPreparationClaim,
} from './order-model.js';
import {
  checkMysqlOrderStorageReady,
  claimMysqlOrderPaymentPreparation,
  claimMysqlOrderFulfillmentReport,
  createMysqlActivityOrderWithCapacity,
  createMysqlOrder,
  deleteOrAnonymizeMysqlOrdersByOpenid,
  finishMysqlOrderPaymentPreparation,
  finishMysqlOrderFulfillmentReport,
  getMysqlOrderById,
  getMysqlOrdersByKind,
  getMysqlOrdersByOpenid,
  getMysqlOrdersByProductId,
  updateMysqlOrderStatus,
} from './mysql-orders.js';

export {
  AccountOrderDeletionBlockedError,
  ActivityCapacityExceededError,
  isAccountOrderDeletionBlockedError,
  isActivityCapacityExceededError,
} from './order-model.js';
export type {
  AccountOrderDeletionResult,
  ActivityOrderCapacity,
  ActivityRegistrationSnapshot,
  CreateOrderInput,
  FulfillmentReportClaim,
  FulfillmentStatus,
  OrderAddressSnapshot,
  OrderKind,
  OrderRecord,
  OrderStatus,
  PaymentPreparationClaim,
  WechatShippingStatus,
} from './order-model.js';

interface OrderStoreState {
  orders: OrderRecord[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'orders.store.json');
const store: OrderStoreState = { orders: [] };

function usesMysqlStorage() {
  return config.shopOrderStorage === 'mysql';
}

function persistOrders() {
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(store.orders, null, 2), 'utf-8');
}

function loadOrders() {
  if (store.orders.length > 0) return;
  if (!existsSync(storageFilePath)) {
    store.orders = [];
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(storageFilePath, 'utf-8')) as OrderRecord[];
    store.orders = Array.isArray(parsed) ? parsed.map(normalizeOrder) : [];
  } catch (error) {
    console.error('[orders store] load error', error);
    store.orders = [];
  }
}

export async function createOrder(input: CreateOrderInput): Promise<OrderRecord> {
  const record = buildNewOrderRecord(input);
  if (usesMysqlStorage()) {
    if (record.kind !== 'shop') {
      const error = new Error('活动订单必须通过名额事务创建') as Error & { code: string };
      error.code = 'ACTIVITY_CAPACITY_TRANSACTION_REQUIRED';
      throw error;
    }
    return createMysqlOrder(record);
  }

  loadOrders();
  const duplicate = store.orders.find((item) => item.id === record.id);
  if (duplicate) return cloneOrder(duplicate);

  store.orders.unshift(record);
  persistOrders();
  return cloneOrder(record);
}

function findActiveActivityOrder(productId: string, openid: string) {
  const matches = store.orders.filter((item) => (
    item.productId === productId
    && item.openid === openid
    && isActiveActivityOrder(item)
  ));
  return matches.find((item) => item.status === 'paid') ?? matches[0] ?? null;
}

export async function createActivityOrderWithCapacity(
  input: CreateOrderInput & { kind: 'activity' },
  capacity: ActivityOrderCapacity,
): Promise<OrderRecord> {
  const record = buildNewOrderRecord(input);
  if (usesMysqlStorage()) return createMysqlActivityOrderWithCapacity(record, capacity);

  loadOrders();
  const duplicate = store.orders.find((item) => item.id === record.id);
  if (duplicate) return cloneOrder(duplicate);

  const existing = findActiveActivityOrder(record.productId, record.openid);
  if (existing) return cloneOrder(existing);

  const activeReservations = store.orders.filter((item) => (
    item.productId === record.productId && isActiveActivityOrder(item)
  )).length;
  const currentParticipants = Math.max(0, Math.floor(sanitizeOrderNumber(capacity.currentParticipants)));
  const maxParticipants = Math.max(0, Math.floor(sanitizeOrderNumber(capacity.maxParticipants)));
  if (maxParticipants > 0 && currentParticipants + activeReservations + 1 > maxParticipants) {
    throw new ActivityCapacityExceededError();
  }

  store.orders.unshift(record);
  persistOrders();
  return cloneOrder(record);
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  const normalizedOrderId = sanitizeOrderString(orderId);
  if (!normalizedOrderId) return null;
  if (usesMysqlStorage()) return getMysqlOrderById(normalizedOrderId);

  loadOrders();
  const record = store.orders.find((item) => item.id === normalizedOrderId) ?? null;
  return record ? cloneOrder(record) : null;
}

export async function getOrdersByOpenid(openid: string, kind?: OrderKind): Promise<OrderRecord[]> {
  const normalizedOpenid = sanitizeOrderString(openid);
  if (!normalizedOpenid) return [];
  if (usesMysqlStorage()) return getMysqlOrdersByOpenid(normalizedOpenid, kind);

  loadOrders();
  return cloneOrder(store.orders
    .filter((item) => item.openid === normalizedOpenid && (!kind || item.kind === kind))
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()));
}

export async function getOrdersByProductId(productId: string, kind?: OrderKind): Promise<OrderRecord[]> {
  const normalizedProductId = sanitizeOrderString(productId);
  if (!normalizedProductId) return [];
  if (usesMysqlStorage()) return getMysqlOrdersByProductId(normalizedProductId, kind);

  loadOrders();
  return cloneOrder(store.orders.filter((item) => (
    item.productId === normalizedProductId && (!kind || item.kind === kind)
  )));
}

export async function getOrdersByKind(kind: OrderKind): Promise<OrderRecord[]> {
  if (usesMysqlStorage()) return getMysqlOrdersByKind(kind);

  loadOrders();
  return cloneOrder(store.orders
    .filter((item) => item.kind === kind)
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()));
}

export async function deleteOrAnonymizeOrdersByOpenid(
  openid: string,
): Promise<AccountOrderDeletionResult> {
  const normalizedOpenid = sanitizeOrderString(openid);
  if (!normalizedOpenid) return { anonymized: 0, deleted: 0 };
  if (usesMysqlStorage()) {
    return deleteOrAnonymizeMysqlOrdersByOpenid(normalizedOpenid);
  }

  loadOrders();
  const matchingOrders = store.orders.filter((item) => item.openid === normalizedOpenid);
  const blockers = matchingOrders.filter(isAccountDeletionBlockingOrder);
  if (blockers.length > 0) {
    throw new AccountOrderDeletionBlockedError(blockers);
  }

  const result: AccountOrderDeletionResult = { anonymized: 0, deleted: 0 };
  const nextOrders: OrderRecord[] = [];
  for (const order of store.orders) {
    if (order.openid !== normalizedOpenid) {
      nextOrders.push(order);
      continue;
    }

    if (shouldRetainOrderAfterAccountDeletion(order)) {
      nextOrders.push(anonymizeOrderForAccountDeletion(order, createAnonymizedOrderOpenid()));
      result.anonymized += 1;
    } else {
      result.deleted += 1;
    }
  }

  if (matchingOrders.length > 0) {
    store.orders = nextOrders;
    persistOrders();
  }
  return result;
}

export async function claimOrderPaymentPreparation(
  orderId: string,
  token: string,
  leaseMilliseconds: number,
): Promise<PaymentPreparationClaim> {
  const normalizedOrderId = sanitizeOrderString(orderId);
  const normalizedToken = sanitizeOrderString(token);
  if (usesMysqlStorage()) {
    return claimMysqlOrderPaymentPreparation(normalizedOrderId, normalizedToken, leaseMilliseconds);
  }

  const preparingUntil = new Date(Date.now() + Math.max(1_000, leaseMilliseconds)).toISOString();
  loadOrders();
  const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
  if (index === -1) return { claimed: false, order: null };

  const current = store.orders[index];
  if (current.status !== 'pending' || current.prepayId || hasActivePaymentPreparation(current)) {
    return { claimed: false, order: cloneOrder(current) };
  }

  store.orders[index] = normalizeOrder({
    ...current,
    paymentPreparationToken: normalizedToken,
    paymentPreparingUntil: preparingUntil,
    updatedAt: nowIso(),
  });
  persistOrders();
  return { claimed: true, order: cloneOrder(store.orders[index]) };
}

export async function finishOrderPaymentPreparation(
  orderId: string,
  token: string,
  input: Pick<OrderRecord, 'prepayId' | 'failureReason'>,
): Promise<OrderRecord | null> {
  const normalizedOrderId = sanitizeOrderString(orderId);
  const normalizedToken = sanitizeOrderString(token);
  if (usesMysqlStorage()) {
    return finishMysqlOrderPaymentPreparation(normalizedOrderId, normalizedToken, input);
  }

  loadOrders();
  const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
  if (index === -1) return null;

  const current = store.orders[index];
  if (current.prepayId || current.status !== 'pending') return cloneOrder(current);
  if (current.paymentPreparationToken !== normalizedToken) return cloneOrder(current);

  store.orders[index] = normalizeOrder({
    ...current,
    prepayId: sanitizeOrderString(input.prepayId),
    failureReason: sanitizeOrderString(input.failureReason),
    paymentPreparationToken: '',
    paymentPreparingUntil: '',
    updatedAt: nowIso(),
  });
  persistOrders();
  return cloneOrder(store.orders[index]);
}

export async function claimOrderFulfillmentReport(
  orderId: string,
  fulfilledBy: string,
  token: string,
  leaseMilliseconds: number,
): Promise<FulfillmentReportClaim> {
  const normalizedOrderId = sanitizeOrderString(orderId);
  const normalizedFulfilledBy = sanitizeOrderString(fulfilledBy);
  const normalizedToken = sanitizeOrderString(token);
  if (usesMysqlStorage()) {
    return claimMysqlOrderFulfillmentReport(
      normalizedOrderId,
      normalizedFulfilledBy,
      normalizedToken,
      leaseMilliseconds,
    );
  }

  loadOrders();
  const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
  if (index === -1) return { claimed: false, order: null, reportRequired: false };

  const current = store.orders[index];
  const reportRequired = current.status === 'paid'
    && !current.mock
    && current.amount > 0;
  const fulfillmentPatch = {
    fulfillmentStatus: 'fulfilled' as const,
    fulfilledAt: current.fulfilledAt || nowIso(),
    fulfilledBy: current.fulfilledBy || normalizedFulfilledBy,
  };

  if (!reportRequired) {
    store.orders[index] = normalizeOrder({
      ...current,
      ...fulfillmentPatch,
      wechatShippingStatus: 'not_required',
      updatedAt: nowIso(),
    });
    persistOrders();
    return { claimed: false, order: cloneOrder(store.orders[index]), reportRequired: false };
  }

  if (current.wechatShippingStatus === 'reported' || hasActiveWechatShippingReport(current)) {
    if (current.fulfillmentStatus !== 'fulfilled') {
      store.orders[index] = normalizeOrder({
        ...current,
        ...fulfillmentPatch,
        updatedAt: nowIso(),
      });
      persistOrders();
    }
    return { claimed: false, order: cloneOrder(store.orders[index]), reportRequired: true };
  }

  store.orders[index] = normalizeOrder({
    ...current,
    ...fulfillmentPatch,
    wechatShippingStatus: 'reporting',
    wechatShippingError: '',
    wechatShippingAttempts: current.wechatShippingAttempts + 1,
    wechatShippingReportToken: normalizedToken,
    wechatShippingReportingUntil: new Date(Date.now() + Math.max(1_000, leaseMilliseconds)).toISOString(),
    updatedAt: nowIso(),
  });
  persistOrders();
  return { claimed: true, order: cloneOrder(store.orders[index]), reportRequired: true };
}

export async function finishOrderFulfillmentReport(
  orderId: string,
  token: string,
  input: { success: boolean; error?: string },
): Promise<OrderRecord | null> {
  const normalizedOrderId = sanitizeOrderString(orderId);
  const normalizedToken = sanitizeOrderString(token);
  if (usesMysqlStorage()) {
    return finishMysqlOrderFulfillmentReport(normalizedOrderId, normalizedToken, input);
  }

  loadOrders();
  const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
  if (index === -1) return null;

  const current = store.orders[index];
  if (current.wechatShippingStatus === 'reported') return cloneOrder(current);
  if (current.wechatShippingReportToken !== normalizedToken) return cloneOrder(current);

  store.orders[index] = normalizeOrder({
    ...current,
    wechatShippingStatus: input.success ? 'reported' : 'failed',
    wechatShippingReportedAt: input.success ? (current.wechatShippingReportedAt || nowIso()) : '',
    wechatShippingError: input.success ? '' : sanitizeOrderString(input.error, '微信履约上报失败'),
    wechatShippingReportToken: '',
    wechatShippingReportingUntil: '',
    updatedAt: nowIso(),
  });
  persistOrders();
  return cloneOrder(store.orders[index]);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  options: {
    transactionId?: string;
    failureReason?: string;
    notifyId?: string;
    paidAt?: string;
  } = {},
): Promise<OrderRecord | null> {
  const normalizedOrderId = sanitizeOrderString(orderId);
  if (usesMysqlStorage()) return updateMysqlOrderStatus(normalizedOrderId, status, options);

  loadOrders();
  const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
  if (index === -1) return null;

  const current = store.orders[index];
  if (current.status === 'paid' && status !== 'paid') return cloneOrder(current);
  if (
    current.status === 'paid'
    && status === 'paid'
    && current.transactionId
    && options.transactionId
    && current.transactionId !== options.transactionId
  ) {
    const error = new Error('已支付订单的微信支付流水号不一致') as Error & { code: string };
    error.code = 'PAYMENT_TRANSACTION_CONFLICT';
    throw error;
  }

  const updatedAt = nowIso();
  const shouldQueueWechatShipping = status === 'paid'
    && !current.mock
    && current.amount > 0
    && current.wechatShippingStatus === 'not_required';
  const next = normalizeOrder({
    ...current,
    status,
    transactionId: options.transactionId || current.transactionId,
    paidAt: status === 'paid' ? (options.paidAt || current.paidAt || updatedAt) : current.paidAt,
    failureReason: options.failureReason ?? current.failureReason,
    lastNotifyId: options.notifyId || current.lastNotifyId,
    paymentPreparationToken: status === 'pending' ? current.paymentPreparationToken : '',
    paymentPreparingUntil: status === 'pending' ? current.paymentPreparingUntil : '',
    wechatShippingStatus: shouldQueueWechatShipping ? 'pending' : current.wechatShippingStatus,
    updatedAt,
  });
  store.orders[index] = next;
  persistOrders();
  return cloneOrder(next);
}

export async function settleFreeOrder(order: OrderRecord): Promise<OrderRecord> {
  if (order.amount !== 0 || order.status !== 'pending') return cloneOrder(order);
  const transactionId = `${order.kind === 'activity' ? 'FREE_ACTIVITY' : 'FREE_SHOP'}_${order.id}`;
  const paidAt = nowIso();
  const settled = await updateOrderStatus(order.id, 'paid', { transactionId, paidAt });
  if (!settled) throw new Error('订单不存在');
  return settled;
}

export function getOrderStorageType() {
  return config.shopOrderStorage;
}

export async function checkOrderStorageReady(): Promise<boolean> {
  if (usesMysqlStorage()) return checkMysqlOrderStorageReady();
  return config.cloudMode !== 'cloudrun' || config.allowEphemeralCloudrunData;
}
