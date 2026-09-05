import { randomUUID } from 'node:crypto';
import type { ShopFulfillmentType } from './shop.js';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'closed';
export type OrderKind = 'shop' | 'activity';
export type FulfillmentStatus = 'pending' | 'fulfilled';
export type WechatShippingStatus = 'not_required' | 'pending' | 'reporting' | 'reported' | 'failed';

export interface ActivityRegistrationSnapshot {
  activityId: string;
  activityTitle: string;
  activityCover: string;
  profileId: string;
  participantNickname: string;
  wechatName: string;
  phone: string;
  profileSnapshot: {
    nickname: string;
    gender: 'female' | 'male' | 'other';
    ageRange: string;
    industry: string;
    occupation: string;
    city: string;
    socialGoal: string;
    introduction: string;
  };
}

export interface OrderAddressSnapshot {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
}

export interface OrderRecord {
  id: string;
  kind: OrderKind;
  clientRequestId: string;
  productId: string;
  productName: string;
  productImageUrl: string;
  unitPrice: number;
  shippingFee: number;
  quantity: number;
  amount: number;
  address: OrderAddressSnapshot | null;
  fulfillmentType: ShopFulfillmentType;
  fulfillmentLabel: string;
  fulfillmentStatus: FulfillmentStatus;
  fulfilledAt: string;
  fulfilledBy: string;
  wechatShippingStatus: WechatShippingStatus;
  wechatShippingReportedAt: string;
  wechatShippingError: string;
  wechatShippingAttempts: number;
  wechatShippingReportToken: string;
  wechatShippingReportingUntil: string;
  unitLabel: string;
  openid: string;
  remark: string;
  activityRegistration?: ActivityRegistrationSnapshot;
  status: OrderStatus;
  mock: boolean;
  prepayId: string;
  paymentPreparationToken: string;
  paymentPreparingUntil: string;
  transactionId: string;
  paidAt: string;
  expiresAt: string;
  failureReason: string;
  lastNotifyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  id: string;
  kind?: OrderKind;
  clientRequestId: string;
  productId: string;
  productName: string;
  productImageUrl: string;
  unitPrice: number;
  shippingFee?: number;
  quantity: number;
  amount: number;
  address: OrderAddressSnapshot | null;
  fulfillmentType: ShopFulfillmentType;
  fulfillmentLabel: string;
  unitLabel: string;
  openid: string;
  remark?: string;
  activityRegistration?: ActivityRegistrationSnapshot;
  status?: OrderStatus;
  mock?: boolean;
  prepayId?: string;
  transactionId?: string;
  paidAt?: string;
  expiresAt: string;
}

export interface ActivityOrderCapacity {
  currentParticipants: number;
  maxParticipants: number;
  configurationVersion: string;
}

export interface ShopOrderStockCapacity {
  stock: number | null;
}

export interface PaymentPreparationClaim {
  claimed: boolean;
  order: OrderRecord | null;
}

export interface FulfillmentReportClaim {
  claimed: boolean;
  order: OrderRecord | null;
  reportRequired: boolean;
}

export interface AccountOrderDeletionResult {
  anonymized: number;
  deleted: number;
}

export class ActivityCapacityExceededError extends Error {
  readonly code = 'ACTIVITY_CAPACITY_EXCEEDED';

  constructor() {
    super('活动名额已满');
    this.name = 'ActivityCapacityExceededError';
  }
}

export class ActivityCapacityConfigurationChangedError extends Error {
  readonly code = 'ACTIVITY_CAPACITY_CONFIGURATION_CHANGED';

  constructor() {
    super('活动名额配置已更新，请刷新后重试');
    this.name = 'ActivityCapacityConfigurationChangedError';
  }
}

export class ShopStockExceededError extends Error {
  readonly code = 'SHOP_STOCK_EXCEEDED';

  constructor() {
    super('商品库存不足');
    this.name = 'ShopStockExceededError';
  }
}

export class ShopStockConfigurationChangedError extends Error {
  readonly code = 'SHOP_STOCK_CONFIGURATION_CHANGED';

  constructor() {
    super('商品价格、库存或履约配置已更新，请刷新后重试');
    this.name = 'ShopStockConfigurationChangedError';
  }
}

export class AccountOrderDeletionBlockedError extends Error {
  readonly code = 'ACCOUNT_DELETION_BLOCKED';
  readonly orders: OrderRecord[];

  constructor(orders: OrderRecord[]) {
    super('账号仍有待支付或未履约订单，暂时无法注销');
    this.name = 'AccountOrderDeletionBlockedError';
    this.orders = cloneOrder(orders);
  }
}

export function isActivityCapacityExceededError(error: unknown): boolean {
  if (error instanceof ActivityCapacityExceededError) return true;
  if (!error || typeof error !== 'object') return false;
  const input = error as { code?: unknown; name?: unknown; message?: unknown };
  return input.code === 'ACTIVITY_CAPACITY_EXCEEDED'
    || input.name === 'ActivityCapacityExceededError'
    || (typeof input.message === 'string' && input.message.includes('活动名额已满'));
}

export function isActivityCapacityConfigurationChangedError(error: unknown): boolean {
  if (error instanceof ActivityCapacityConfigurationChangedError) return true;
  if (!error || typeof error !== 'object') return false;
  const input = error as { code?: unknown; name?: unknown };
  return input.code === 'ACTIVITY_CAPACITY_CONFIGURATION_CHANGED'
    || input.name === 'ActivityCapacityConfigurationChangedError';
}

export function isShopStockExceededError(error: unknown): boolean {
  if (error instanceof ShopStockExceededError) return true;
  if (!error || typeof error !== 'object') return false;
  const input = error as { code?: unknown; name?: unknown; message?: unknown };
  return input.code === 'SHOP_STOCK_EXCEEDED'
    || input.name === 'ShopStockExceededError'
    || (typeof input.message === 'string' && input.message.includes('商品库存不足'));
}

export function isShopStockConfigurationChangedError(error: unknown): boolean {
  if (error instanceof ShopStockConfigurationChangedError) return true;
  if (!error || typeof error !== 'object') return false;
  const input = error as { code?: unknown; name?: unknown };
  return input.code === 'SHOP_STOCK_CONFIGURATION_CHANGED'
    || input.name === 'ShopStockConfigurationChangedError';
}

export function isAccountOrderDeletionBlockedError(
  error: unknown,
): error is AccountOrderDeletionBlockedError {
  if (error instanceof AccountOrderDeletionBlockedError) return true;
  if (!error || typeof error !== 'object') return false;
  const input = error as { code?: unknown; name?: unknown };
  return input.code === 'ACCOUNT_DELETION_BLOCKED'
    || input.name === 'AccountOrderDeletionBlockedError';
}

export function cloneOrder<T>(value: T): T {
  return structuredClone(value);
}

export function nowIso() {
  return new Date().toISOString();
}

export function sanitizeOrderString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function sanitizeOrderNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeStatus(value: unknown): OrderStatus {
  if (value === 'paid' || value === 'failed' || value === 'closed') return value;
  return 'pending';
}

function sanitizeOrderKind(value: unknown): OrderKind {
  return value === 'activity' ? 'activity' : 'shop';
}

function sanitizeFulfillmentType(value: unknown, fallback: ShopFulfillmentType): ShopFulfillmentType {
  return value === 'delivery' || value === 'onsite' || value === 'pickup' ? value : fallback;
}

function sanitizeFulfillmentStatus(value: unknown): FulfillmentStatus {
  return value === 'fulfilled' ? 'fulfilled' : 'pending';
}

function sanitizeWechatShippingStatus(value: unknown, fallback: WechatShippingStatus): WechatShippingStatus {
  return value === 'not_required'
    || value === 'pending'
    || value === 'reporting'
    || value === 'reported'
    || value === 'failed'
    ? value
    : fallback;
}

function getDefaultFulfillmentLabel(type: ShopFulfillmentType, kind: OrderKind) {
  if (type === 'onsite') return kind === 'activity' ? '现场参与' : '到店享用';
  if (type === 'pickup') return '到店自提';
  return '快递配送';
}

function normalizeActivityRegistration(value: Partial<ActivityRegistrationSnapshot> | undefined) {
  if (!value || typeof value !== 'object') return undefined;
  const profileSnapshot = value.profileSnapshot && typeof value.profileSnapshot === 'object'
    ? value.profileSnapshot
    : {} as Partial<ActivityRegistrationSnapshot['profileSnapshot']>;
  const gender = profileSnapshot.gender === 'female' || profileSnapshot.gender === 'male'
    ? profileSnapshot.gender
    : 'other';
  return {
    activityId: sanitizeOrderString(value.activityId),
    activityTitle: sanitizeOrderString(value.activityTitle),
    activityCover: sanitizeOrderString(value.activityCover),
    profileId: sanitizeOrderString(value.profileId),
    participantNickname: sanitizeOrderString(value.participantNickname),
    wechatName: sanitizeOrderString(value.wechatName),
    phone: sanitizeOrderString(value.phone),
    profileSnapshot: {
      nickname: sanitizeOrderString(profileSnapshot.nickname),
      gender,
      ageRange: sanitizeOrderString(profileSnapshot.ageRange),
      industry: sanitizeOrderString(profileSnapshot.industry),
      occupation: sanitizeOrderString(profileSnapshot.occupation),
      city: sanitizeOrderString(profileSnapshot.city),
      socialGoal: sanitizeOrderString(profileSnapshot.socialGoal),
      introduction: sanitizeOrderString(profileSnapshot.introduction),
    },
  } satisfies ActivityRegistrationSnapshot;
}

function normalizeAddress(value: Partial<OrderAddressSnapshot> | null | undefined): OrderAddressSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const address = {
    name: sanitizeOrderString(value.name),
    phone: sanitizeOrderString(value.phone),
    province: sanitizeOrderString(value.province),
    city: sanitizeOrderString(value.city),
    district: sanitizeOrderString(value.district),
    detail: sanitizeOrderString(value.detail),
  };
  return Object.values(address).some(Boolean) ? address : null;
}

export function normalizeOrder(item: Partial<OrderRecord>): OrderRecord {
  const createdAt = sanitizeOrderString(item.createdAt) || nowIso();
  const unitPrice = sanitizeOrderNumber(
    item.unitPrice,
    item.quantity ? sanitizeOrderNumber(item.amount) / sanitizeOrderNumber(item.quantity, 1) : 0,
  );
  const kind = sanitizeOrderKind(item.kind);
  const address = normalizeAddress(item.address);
  const status = sanitizeStatus(item.status);
  const mock = Boolean(item.mock);
  const amount = Math.max(0, Math.round(sanitizeOrderNumber(item.amount)));
  const fulfillmentType = sanitizeFulfillmentType(
    item.fulfillmentType,
    kind === 'activity' || !address ? 'onsite' : 'delivery',
  );
  const fulfillmentStatus = sanitizeFulfillmentStatus(item.fulfillmentStatus);
  const shippingRequired = status === 'paid' && !mock && amount > 0;
  const wechatShippingStatus = sanitizeWechatShippingStatus(
    item.wechatShippingStatus,
    shippingRequired ? 'pending' : 'not_required',
  );
  return {
    id: sanitizeOrderString(item.id),
    kind,
    clientRequestId: sanitizeOrderString(item.clientRequestId) || sanitizeOrderString(item.id),
    productId: sanitizeOrderString(item.productId),
    productName: sanitizeOrderString(item.productName),
    productImageUrl: sanitizeOrderString(item.productImageUrl),
    unitPrice: Math.max(0, Math.round(unitPrice)),
    shippingFee: Math.max(0, Math.round(sanitizeOrderNumber(item.shippingFee))),
    quantity: Math.max(1, Math.floor(sanitizeOrderNumber(item.quantity, 1))),
    amount,
    address,
    fulfillmentType,
    fulfillmentLabel: sanitizeOrderString(item.fulfillmentLabel)
      || getDefaultFulfillmentLabel(fulfillmentType, kind),
    fulfillmentStatus,
    fulfilledAt: sanitizeOrderString(item.fulfilledAt),
    fulfilledBy: sanitizeOrderString(item.fulfilledBy),
    wechatShippingStatus,
    wechatShippingReportedAt: sanitizeOrderString(item.wechatShippingReportedAt),
    wechatShippingError: sanitizeOrderString(item.wechatShippingError),
    wechatShippingAttempts: Math.max(0, Math.floor(sanitizeOrderNumber(item.wechatShippingAttempts))),
    wechatShippingReportToken: sanitizeOrderString(item.wechatShippingReportToken),
    wechatShippingReportingUntil: sanitizeOrderString(item.wechatShippingReportingUntil),
    unitLabel: sanitizeOrderString(item.unitLabel) || (kind === 'activity' ? '位' : '件'),
    openid: sanitizeOrderString(item.openid),
    remark: sanitizeOrderString(item.remark),
    activityRegistration: normalizeActivityRegistration(item.activityRegistration),
    status,
    mock,
    prepayId: sanitizeOrderString(item.prepayId),
    paymentPreparationToken: sanitizeOrderString(item.paymentPreparationToken),
    paymentPreparingUntil: sanitizeOrderString(item.paymentPreparingUntil),
    transactionId: sanitizeOrderString(item.transactionId),
    paidAt: sanitizeOrderString(item.paidAt),
    expiresAt: sanitizeOrderString(item.expiresAt),
    failureReason: sanitizeOrderString(item.failureReason),
    lastNotifyId: sanitizeOrderString(item.lastNotifyId),
    createdAt,
    updatedAt: sanitizeOrderString(item.updatedAt) || createdAt,
  };
}

export function buildNewOrderRecord(input: CreateOrderInput): OrderRecord {
  const timestamp = nowIso();
  return normalizeOrder({
    ...input,
    remark: input.remark ?? '',
    status: input.status ?? 'pending',
    mock: input.mock ?? false,
    prepayId: input.prepayId ?? '',
    transactionId: input.transactionId ?? '',
    paidAt: input.paidAt ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Orders that can still charge the user or represent an undelivered entitlement
 * must be resolved before account deletion. This check is repeated inside the
 * storage transaction so a payment callback cannot race the preview screen.
 */
export function isAccountDeletionBlockingOrder(order: OrderRecord) {
  if (order.mock) return false;
  if (order.status === 'pending' && order.amount > 0) return true;
  return order.status === 'paid' && order.fulfillmentStatus !== 'fulfilled';
}

/**
 * Real payment evidence is retained only when it may still be needed for a
 * payment callback, reconciliation or statutory bookkeeping. All direct user
 * identifiers are removed before the record is retained.
 */
export function shouldRetainOrderAfterAccountDeletion(order: OrderRecord) {
  // Paid orders are also the durable sold-capacity record. Deleting a free or
  // mock paid order would make finite shop stock (and activity capacity) grow
  // back after account deletion. Keep the anonymized accounting fact instead.
  if (order.status === 'paid') return true;
  if (order.mock || order.amount <= 0) return false;
  return Boolean(order.prepayId);
}

export function createAnonymizedOrderOpenid() {
  return `deleted_${randomUUID().replaceAll('-', '')}`;
}

export function anonymizeOrderForAccountDeletion(
  order: OrderRecord,
  anonymizedOpenid: string,
): OrderRecord {
  const activityRegistration = order.activityRegistration
    ? {
        activityId: order.activityRegistration.activityId,
        activityTitle: order.activityRegistration.activityTitle,
        activityCover: order.activityRegistration.activityCover,
        profileId: '',
        participantNickname: '已注销用户',
        wechatName: '',
        phone: '',
        profileSnapshot: {
          nickname: '',
          gender: 'other' as const,
          ageRange: '',
          industry: '',
          occupation: '',
          city: '',
          socialGoal: '',
          introduction: '',
        },
      }
    : undefined;

  return normalizeOrder({
    ...order,
    openid: sanitizeOrderString(anonymizedOpenid),
    clientRequestId: `deleted-${order.id}`,
    address: null,
    remark: '',
    activityRegistration,
    prepayId: '',
    paymentPreparationToken: '',
    paymentPreparingUntil: '',
    fulfilledBy: '',
    wechatShippingError: '',
    wechatShippingReportToken: '',
    wechatShippingReportingUntil: '',
    failureReason: '',
    lastNotifyId: '',
    updatedAt: nowIso(),
  });
}

export function isActiveActivityOrder(order: OrderRecord) {
  return order.kind === 'activity' && (order.status === 'pending' || order.status === 'paid');
}

export function isActiveShopOrder(order: OrderRecord) {
  return order.kind === 'shop' && (order.status === 'pending' || order.status === 'paid');
}

export function hasActivePaymentPreparation(order: OrderRecord) {
  const preparingUntil = Date.parse(order.paymentPreparingUntil);
  return Boolean(
    order.paymentPreparationToken
    && Number.isFinite(preparingUntil)
    && preparingUntil > Date.now()
  );
}

export function hasActiveWechatShippingReport(order: OrderRecord) {
  const reportingUntil = Date.parse(order.wechatShippingReportingUntil);
  return Boolean(
    order.wechatShippingStatus === 'reporting'
    && order.wechatShippingReportToken
    && Number.isFinite(reportingUntil)
    && reportingUntil > Date.now()
  );
}
