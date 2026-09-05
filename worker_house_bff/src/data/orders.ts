import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { getActivityById } from './activities.js';
import {
  AccountOrderDeletionBlockedError,
  ActivityCapacityConfigurationChangedError,
  ActivityCapacityExceededError,
  ShopStockConfigurationChangedError,
  ShopStockExceededError,
  anonymizeOrderForAccountDeletion,
  buildNewOrderRecord,
  cloneOrder,
  createAnonymizedOrderOpenid,
  hasActivePaymentPreparation,
  hasActiveWechatShippingReport,
  isAccountDeletionBlockingOrder,
  isActiveActivityOrder,
  isActiveShopOrder,
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
  type ShopOrderStockCapacity,
} from './order-model.js';
import {
  checkMysqlOrderStorageReady,
  claimMysqlOrderPaymentPreparation,
  claimMysqlOrderFulfillmentReport,
  createMysqlActivityOrderWithCapacity,
  createMysqlShopOrderWithStock,
  deleteOrAnonymizeMysqlOrdersByOpenid,
  finishMysqlOrderPaymentPreparation,
  finishMysqlOrderFulfillmentReport,
  getMysqlOrderById,
  getMysqlActiveShopOrdersByProductIds,
  getMysqlOrdersByKind,
  getMysqlOrdersByOpenid,
  getMysqlOrdersByProductId,
  updateMysqlOrderStatus,
} from './mysql-orders.js';

export {
  AccountOrderDeletionBlockedError,
  ActivityCapacityConfigurationChangedError,
  ActivityCapacityExceededError,
  ShopStockConfigurationChangedError,
  ShopStockExceededError,
  isAccountOrderDeletionBlockedError,
  isActivityCapacityConfigurationChangedError,
  isActivityCapacityExceededError,
  isShopStockConfigurationChangedError,
  isShopStockExceededError,
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
  ShopOrderStockCapacity,
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
  const kind = input.kind === 'activity' ? 'activity' : 'shop';
  const error = new Error(
    kind === 'activity'
      ? '活动订单必须通过名额事务创建'
      : '商城订单必须通过库存事务创建',
  ) as Error & { code: string };
  error.code = kind === 'activity'
    ? 'ACTIVITY_CAPACITY_TRANSACTION_REQUIRED'
    : 'SHOP_STOCK_TRANSACTION_REQUIRED';
  throw error;
}

function normalizeShopStockCapacity(capacity: ShopOrderStockCapacity) {
  if (capacity.stock === null) return null;
  if (!Number.isSafeInteger(capacity.stock) || capacity.stock < 0) {
    throw new ShopStockConfigurationChangedError();
  }
  return capacity.stock;
}

export async function createShopOrderWithStock(
  input: CreateOrderInput & { kind?: 'shop' },
  capacity: ShopOrderStockCapacity,
): Promise<OrderRecord> {
  const record = buildNewOrderRecord({ ...input, kind: 'shop' });
  if (usesMysqlStorage()) return createMysqlShopOrderWithStock(record, capacity);

  loadOrders();
  const duplicate = store.orders.find((item) => item.id === record.id);
  if (duplicate) return cloneOrder(duplicate);

  const stock = normalizeShopStockCapacity(capacity);
  if (stock !== null) {
    const reservedQuantity = store.orders
      .filter((item) => item.productId === record.productId && isActiveShopOrder(item))
      .reduce((total, item) => total + item.quantity, 0);
    if (!Number.isSafeInteger(reservedQuantity) || reservedQuantity + record.quantity > stock) {
      throw new ShopStockExceededError();
    }
  }

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

function normalizeActivityCapacity(capacity: ActivityOrderCapacity) {
  if (
    !Number.isSafeInteger(capacity.currentParticipants)
    || capacity.currentParticipants < 0
    || !Number.isSafeInteger(capacity.maxParticipants)
    || capacity.maxParticipants < 1
    || capacity.currentParticipants > capacity.maxParticipants
    || !sanitizeOrderString(capacity.configurationVersion)
  ) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  return {
    currentParticipants: capacity.currentParticipants,
    maxParticipants: capacity.maxParticipants,
    configurationVersion: sanitizeOrderString(capacity.configurationVersion),
  };
}

function activityPriceInCents(price: unknown) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  const cents = Math.round(price * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(price * 100 - cents) > 1e-8) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  return cents;
}

function resolveFileActivityCapacity(record: OrderRecord, expected: ActivityOrderCapacity) {
  const capacity = normalizeActivityCapacity(expected);
  const activity = getActivityById(record.productId);
  if (
    !activity
    || activity.enabled !== true
    || activity.updatedAt !== capacity.configurationVersion
    || activity.currentParticipants !== capacity.currentParticipants
    || activity.maxParticipants !== capacity.maxParticipants
    || record.quantity !== 1
    || record.amount !== record.unitPrice
    || activityPriceInCents(activity.price) !== record.unitPrice
  ) {
    throw new ActivityCapacityConfigurationChangedError();
  }
  return capacity;
}

export async function createActivityOrderWithCapacity(
  input: CreateOrderInput & { kind: 'activity' },
  capacity: ActivityOrderCapacity,
): Promise<OrderRecord> {
  const record = buildNewOrderRecord(input);
  if (usesMysqlStorage()) return createMysqlActivityOrderWithCapacity(record, capacity);

  loadOrders();
  // File/mock mode is single-process. There is no await between this fresh
  // catalog read, the reservation check and persistOrders(), which makes the
  // validation/order write atomic with the synchronous activity CRUD path.
  const resolvedCapacity = resolveFileActivityCapacity(record, capacity);
  const duplicate = store.orders.find((item) => item.id === record.id);
  if (duplicate) return cloneOrder(duplicate);

  const existing = findActiveActivityOrder(record.productId, record.openid);
  if (existing) return cloneOrder(existing);

  const activeReservations = store.orders.filter((item) => (
    item.productId === record.productId && isActiveActivityOrder(item)
  )).length;
  const { currentParticipants, maxParticipants } = resolvedCapacity;
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

export async function getActiveShopOrdersByProductIds(productIds: string[]): Promise<OrderRecord[]> {
  const normalizedProductIds = Array.from(new Set(
    productIds.map((productId) => sanitizeOrderString(productId)).filter(Boolean),
  ));
  if (normalizedProductIds.length === 0) return [];
  if (usesMysqlStorage()) return getMysqlActiveShopOrdersByProductIds(normalizedProductIds);

  const productIdSet = new Set(normalizedProductIds);
  loadOrders();
  return cloneOrder(store.orders.filter((item) => (
    productIdSet.has(item.productId) && isActiveShopOrder(item)
  )));
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
    activityCapacity?: ActivityOrderCapacity;
    shopStock?: number | null;
  } = {},
): Promise<OrderRecord | null> {
  const normalizedOrderId = sanitizeOrderString(orderId);
  if (usesMysqlStorage()) return updateMysqlOrderStatus(normalizedOrderId, status, options);

  loadOrders();
  const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
  if (index === -1) return null;

  const current = store.orders[index];
  if (current.status === 'paid' && status !== 'paid') return cloneOrder(current);
  if ((current.status === 'closed' || current.status === 'failed') && status === 'pending') {
    const error = new Error('终态订单不能恢复为待支付') as Error & { code: string };
    error.code = 'ORDER_STATUS_TRANSITION_INVALID';
    throw error;
  }
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

  if (current.kind === 'shop' && status === 'paid' && !isActiveShopOrder(current)) {
    if (options.shopStock === undefined) throw new ShopStockConfigurationChangedError();
    const stock = normalizeShopStockCapacity({ stock: options.shopStock });
    if (stock !== null) {
      const reservedQuantity = store.orders
        .filter((item) => item.productId === current.productId && isActiveShopOrder(item))
        .reduce((total, item) => total + item.quantity, 0);
      if (!Number.isSafeInteger(reservedQuantity) || reservedQuantity + current.quantity > stock) {
        throw new ShopStockExceededError();
      }
    }
  }
  if (current.kind === 'activity' && status === 'paid' && !isActiveActivityOrder(current)) {
    if (!options.activityCapacity) throw new ActivityCapacityConfigurationChangedError();
    const { currentParticipants, maxParticipants } = resolveFileActivityCapacity(
      current,
      options.activityCapacity,
    );
    const activeReservations = store.orders.filter((item) => (
      item.productId === current.productId && isActiveActivityOrder(item)
    ));
    if (
      activeReservations.some((item) => item.openid === current.openid)
      || (maxParticipants > 0 && currentParticipants + activeReservations.length + 1 > maxParticipants)
    ) {
      throw new ActivityCapacityExceededError();
    }
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
