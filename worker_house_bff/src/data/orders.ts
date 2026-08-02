import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cloudbase from '@cloudbase/js-sdk';
import { config } from '../config.js';
import type { ShopFulfillmentType } from './shop.js';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'closed';
export type OrderKind = 'shop' | 'activity';

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
  quantity: number;
  amount: number;
  address: OrderAddressSnapshot | null;
  fulfillmentType: ShopFulfillmentType;
  fulfillmentLabel: string;
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

interface OrderStoreState {
  orders: OrderRecord[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'orders.store.json');

const store: OrderStoreState = { orders: [] };

type CloudDatabase = cloudbase.database.App;
type CloudDatabaseWithCollectionSetup = CloudDatabase & {
  createCollection(name: string): Promise<{ code?: string; message?: string }>;
};
interface CloudTransactionDocument {
  get(): Promise<{ data: unknown }>;
  set(data: object): Promise<unknown>;
  update(data: object): Promise<unknown>;
}
interface CloudTransactionCollection {
  add(data: object): Promise<unknown>;
  doc(id: string): CloudTransactionDocument;
}
interface CloudTransaction {
  collection(name: string): CloudTransactionCollection;
}
type CloudDatabaseWithTransactions = CloudDatabase & {
  runTransaction<T>(handler: (transaction: CloudTransaction) => Promise<T>): Promise<T>;
};

let cloudDatabase: CloudDatabase | null = null;
let cloudCollectionReady: Promise<void> | null = null;
const CLOUD_QUERY_PAGE_SIZE = 100;
const ACTIVITY_CAPACITY_RECORD_TYPE = 'activity_capacity';
const MAX_ACTIVITY_CAPACITY_BOOTSTRAP_ORDERS = 40;

type ActivityCapacityReservationStatus = 'pending' | 'paid';

interface ActivityCapacityReservation {
  orderId: string;
  openid: string;
  status: ActivityCapacityReservationStatus;
  expiresAt: string;
}

interface ActivityCapacityRecord {
  recordType: typeof ACTIVITY_CAPACITY_RECORD_TYPE;
  activityId: string;
  reservations: ActivityCapacityReservation[];
  updatedAt: string;
}

export class ActivityCapacityExceededError extends Error {
  readonly code = 'ACTIVITY_CAPACITY_EXCEEDED';

  constructor() {
    super('活动名额已满');
    this.name = 'ActivityCapacityExceededError';
  }
}

export class ActivityCapacityInitializationError extends Error {
  readonly code = 'ACTIVITY_CAPACITY_INITIALIZATION_REQUIRED';

  constructor() {
    super('活动名额账本需要人工迁移');
    this.name = 'ActivityCapacityInitializationError';
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

export function isActivityCapacityInitializationError(error: unknown): boolean {
  if (error instanceof ActivityCapacityInitializationError) return true;
  if (!error || typeof error !== 'object') return false;
  const input = error as { code?: unknown; name?: unknown };
  return input.code === 'ACTIVITY_CAPACITY_INITIALIZATION_REQUIRED'
    || input.name === 'ActivityCapacityInitializationError';
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function usesCloudbaseStorage() {
  return config.shopOrderStorage === 'cloudbase';
}

function getCloudErrorText(error: unknown) {
  if (!error || typeof error !== 'object') return String(error || 'unknown');
  const input = error as { code?: unknown; message?: unknown; errCode?: unknown; errMsg?: unknown };
  return [input.code, input.errCode, input.message, input.errMsg].filter(Boolean).join(' ');
}

export function unwrapCloudTransactionDocuments(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.flatMap((item) => unwrapCloudTransactionDocuments(item));
  }
  if (typeof data !== 'object') return [];

  const input = data as Record<string, unknown>;
  if (Array.isArray(input.list)) {
    return unwrapCloudTransactionDocuments(input.list);
  }
  if (
    Object.prototype.hasOwnProperty.call(input, 'data')
    && (input.data === null || Array.isArray(input.data) || typeof input.data === 'object')
  ) {
    return unwrapCloudTransactionDocuments(input.data);
  }
  return [input];
}

function getTransactionOrder(data: unknown): Partial<OrderRecord> | undefined {
  return unwrapCloudTransactionDocuments(data)[0] as Partial<OrderRecord> | undefined;
}

function isCollectionMissingError(error: unknown) {
  return /(COLLECTION|TABLE).*(NOT[_ ]?EXIST|NOT[_ ]?FOUND)|集合.*不存在|-502005/i.test(getCloudErrorText(error));
}

function isCollectionAlreadyExistsError(error: unknown) {
  return /(COLLECTION|TABLE).*(ALREADY[_ ]?EXIST)|集合.*已存在|-502002/i.test(getCloudErrorText(error));
}

function getCloudDatabase() {
  if (cloudDatabase) return cloudDatabase;
  const app = cloudbase.init(config.cloudEnvId ? { env: config.cloudEnvId } : {});
  cloudDatabase = app.database();
  return cloudDatabase;
}

async function ensureCloudCollection() {
  if (!usesCloudbaseStorage()) return;
  if (cloudCollectionReady) return cloudCollectionReady;

  cloudCollectionReady = (async () => {
    const database = getCloudDatabase();
    try {
      await database.collection(config.shopOrderCollection).limit(1).get();
      return;
    } catch (error) {
      if (!isCollectionMissingError(error)) throw error;
    }

    try {
      await (database as CloudDatabaseWithCollectionSetup).createCollection(config.shopOrderCollection);
    } catch (error) {
      if (!isCollectionAlreadyExistsError(error)) throw error;
    }

    await database.collection(config.shopOrderCollection).limit(1).get();
  })().catch((error) => {
    cloudCollectionReady = null;
    throw error;
  });

  return cloudCollectionReady;
}

async function getCloudOrderById(orderId: string): Promise<OrderRecord | null> {
  await ensureCloudCollection();
  const response = await getCloudDatabase()
    .collection(config.shopOrderCollection)
    .doc(sanitizeString(orderId))
    .get();
  const item = response.data?.[0] as Partial<OrderRecord> | undefined;
  return item ? normalizeOrder(item) : null;
}

async function getAllCloudOrders(match: Record<string, unknown>): Promise<OrderRecord[]> {
  await ensureCloudCollection();
  const collection = getCloudDatabase().collection(config.shopOrderCollection);
  const orders: OrderRecord[] = [];
  let offset = 0;

  while (true) {
    const response = await collection
      .where(match)
      .skip(offset)
      .limit(CLOUD_QUERY_PAGE_SIZE)
      .get();
    const page = (response.data || []).map((item) => normalizeOrder(item as Partial<OrderRecord>));
    orders.push(...page);
    if (page.length < CLOUD_QUERY_PAGE_SIZE) break;
    offset += page.length;
  }

  return orders;
}

function sanitizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeStatus(value: unknown): OrderStatus {
  if (value === 'paid' || value === 'failed' || value === 'closed') {
    return value;
  }
  return 'pending';
}

function sanitizeOrderKind(value: unknown): OrderKind {
  return value === 'activity' ? 'activity' : 'shop';
}

function sanitizeFulfillmentType(value: unknown, fallback: ShopFulfillmentType): ShopFulfillmentType {
  return value === 'delivery' || value === 'onsite' || value === 'pickup' ? value : fallback;
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
    activityId: sanitizeString(value.activityId),
    activityTitle: sanitizeString(value.activityTitle),
    activityCover: sanitizeString(value.activityCover),
    profileId: sanitizeString(value.profileId),
    participantNickname: sanitizeString(value.participantNickname),
    wechatName: sanitizeString(value.wechatName),
    phone: sanitizeString(value.phone),
    profileSnapshot: {
      nickname: sanitizeString(profileSnapshot.nickname),
      gender,
      ageRange: sanitizeString(profileSnapshot.ageRange),
      industry: sanitizeString(profileSnapshot.industry),
      occupation: sanitizeString(profileSnapshot.occupation),
      city: sanitizeString(profileSnapshot.city),
      socialGoal: sanitizeString(profileSnapshot.socialGoal),
      introduction: sanitizeString(profileSnapshot.introduction),
    },
  } satisfies ActivityRegistrationSnapshot;
}

function normalizeAddress(value: Partial<OrderAddressSnapshot> | null | undefined): OrderAddressSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const address = {
    name: sanitizeString(value?.name),
    phone: sanitizeString(value?.phone),
    province: sanitizeString(value?.province),
    city: sanitizeString(value?.city),
    district: sanitizeString(value?.district),
    detail: sanitizeString(value?.detail),
  };
  return Object.values(address).some(Boolean) ? address : null;
}

function normalizeOrder(item: Partial<OrderRecord>): OrderRecord {
  const createdAt = sanitizeString(item.createdAt) || now();
  const unitPrice = sanitizeNumber(item.unitPrice, item.quantity ? sanitizeNumber(item.amount) / sanitizeNumber(item.quantity, 1) : 0);
  const kind = sanitizeOrderKind(item.kind);
  const fulfillmentType = sanitizeFulfillmentType(item.fulfillmentType, kind === 'activity' ? 'onsite' : 'delivery');
  return {
    id: sanitizeString(item.id),
    kind,
    clientRequestId: sanitizeString(item.clientRequestId) || sanitizeString(item.id),
    productId: sanitizeString(item.productId),
    productName: sanitizeString(item.productName),
    productImageUrl: sanitizeString(item.productImageUrl),
    unitPrice: Math.max(0, Math.round(unitPrice)),
    quantity: Math.max(1, Math.floor(sanitizeNumber(item.quantity, 1))),
    amount: Math.max(0, Math.round(sanitizeNumber(item.amount))),
    address: normalizeAddress(item.address),
    fulfillmentType,
    fulfillmentLabel: sanitizeString(item.fulfillmentLabel) || getDefaultFulfillmentLabel(fulfillmentType, kind),
    unitLabel: sanitizeString(item.unitLabel) || (kind === 'activity' ? '位' : '件'),
    openid: sanitizeString(item.openid),
    remark: sanitizeString(item.remark),
    activityRegistration: normalizeActivityRegistration(item.activityRegistration),
    status: sanitizeStatus(item.status),
    mock: Boolean(item.mock),
    prepayId: sanitizeString(item.prepayId),
    paymentPreparationToken: sanitizeString(item.paymentPreparationToken),
    paymentPreparingUntil: sanitizeString(item.paymentPreparingUntil),
    transactionId: sanitizeString(item.transactionId),
    paidAt: sanitizeString(item.paidAt),
    expiresAt: sanitizeString(item.expiresAt),
    failureReason: sanitizeString(item.failureReason),
    lastNotifyId: sanitizeString(item.lastNotifyId),
    createdAt,
    updatedAt: sanitizeString(item.updatedAt) || createdAt,
  };
}

function getActivityCapacityDocumentId(activityId: string) {
  const digest = createHash('sha256').update(activityId).digest('hex').slice(0, 40);
  return `ACTIVITY_CAPACITY_${digest}`;
}

function getTransactionCapacity(data: unknown): Partial<ActivityCapacityRecord> | undefined {
  return unwrapCloudTransactionDocuments(data)[0] as Partial<ActivityCapacityRecord> | undefined;
}

function isActivityCapacityRecord(
  record: Partial<ActivityCapacityRecord> | undefined,
  activityId: string,
): record is ActivityCapacityRecord {
  return record?.recordType === ACTIVITY_CAPACITY_RECORD_TYPE
    && sanitizeString(record.activityId) === activityId
    && Array.isArray(record.reservations);
}

async function getCloudActivityCapacityRecord(activityId: string) {
  await ensureCloudCollection();
  const response = await getCloudDatabase()
    .collection(config.shopOrderCollection)
    .doc(getActivityCapacityDocumentId(activityId))
    .get();
  return getTransactionCapacity(response.data);
}

function getOrderCapacityReservation(order: OrderRecord): ActivityCapacityReservation | null {
  if (order.kind !== 'activity') return null;
  if (order.status !== 'paid' && order.status !== 'pending') return null;
  return {
    orderId: order.id,
    openid: order.openid,
    status: order.status,
    expiresAt: order.expiresAt,
  };
}

function mergeCapacityReservation(
  reservations: Map<string, ActivityCapacityReservation>,
  reservation: ActivityCapacityReservation,
) {
  const current = reservations.get(reservation.orderId);
  if (!current || reservation.status === 'paid' || current.status !== 'paid') {
    reservations.set(reservation.orderId, reservation);
  }
}

function buildActiveCapacityReservations(
  stored: Partial<ActivityCapacityRecord> | undefined,
  initialOrders: readonly OrderRecord[],
) {
  const reservations = new Map<string, ActivityCapacityReservation>();
  if (Array.isArray(stored?.reservations)) {
    for (const rawReservation of stored.reservations) {
      if (!rawReservation || typeof rawReservation !== 'object') continue;
      const orderId = sanitizeString(rawReservation.orderId);
      const status = rawReservation.status === 'paid' || rawReservation.status === 'pending'
        ? rawReservation.status
        : null;
      if (!orderId || !status) continue;
      const reservation: ActivityCapacityReservation = {
        orderId,
        openid: sanitizeString(rawReservation.openid),
        status,
        expiresAt: sanitizeString(rawReservation.expiresAt),
      };
      mergeCapacityReservation(reservations, reservation);
    }
  }

  for (const order of initialOrders) {
    const reservation = getOrderCapacityReservation(order);
    if (reservation) mergeCapacityReservation(reservations, reservation);
  }
  return reservations;
}

function buildActivityCapacityRecord(
  activityId: string,
  reservations: Map<string, ActivityCapacityReservation>,
  updatedAt: string,
): ActivityCapacityRecord {
  return {
    recordType: ACTIVITY_CAPACITY_RECORD_TYPE,
    activityId,
    reservations: [...reservations.values()],
    updatedAt,
  };
}

function findExistingOpenidReservation(
  reservations: Map<string, ActivityCapacityReservation>,
  order: OrderRecord,
) {
  const matches = [...reservations.values()].filter((reservation) => (
    reservation.orderId !== order.id
    && Boolean(order.openid)
    && reservation.openid === order.openid
  ));
  return matches.find((reservation) => reservation.status === 'paid') ?? matches[0] ?? null;
}

function buildNewOrderRecord(input: CreateOrderInput): OrderRecord {
  const timestamp = now();
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

export interface CreateOrderInput {
  id: string;
  kind?: OrderKind;
  clientRequestId: string;
  productId: string;
  productName: string;
  productImageUrl: string;
  unitPrice: number;
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

export async function createOrder(input: CreateOrderInput): Promise<OrderRecord> {
  const record = buildNewOrderRecord(input);
  if (usesCloudbaseStorage()) {
    await ensureCloudCollection();
    return (getCloudDatabase() as CloudDatabaseWithTransactions).runTransaction(async (transaction) => {
      const collection = transaction.collection(config.shopOrderCollection);
      const document = collection.doc(record.id);
      const response = await document.get();
      const stored = getTransactionOrder(response.data);
      if (stored) return clone(normalizeOrder(stored));

      // SDK 3.7.0 的 Gateway 事务 create 不会转发顶层 _id；必须同时放进 data。
      await collection.add({ ...record, _id: record.id });
      return clone(record);
    });
  }

  loadOrders();
  const duplicate = store.orders.find((item) => item.id === input.id);
  if (duplicate) return clone(duplicate);

  store.orders.unshift(record);
  persistOrders();
  return clone(record);
}

export interface ActivityOrderCapacity {
  currentParticipants: number;
  maxParticipants: number;
}

export async function createActivityOrderWithCapacity(
  input: CreateOrderInput & { kind: 'activity' },
  capacity: ActivityOrderCapacity,
): Promise<OrderRecord> {
  const record = buildNewOrderRecord(input);
  const currentParticipants = Math.max(0, Math.floor(sanitizeNumber(capacity.currentParticipants)));
  const maxParticipants = Math.max(0, Math.floor(sanitizeNumber(capacity.maxParticipants)));
  if (usesCloudbaseStorage()) {
    await ensureCloudCollection();
    const existingCapacity = await getCloudActivityCapacityRecord(record.productId);
    const needsBootstrap = !isActivityCapacityRecord(existingCapacity, record.productId);
    const initialOrders = needsBootstrap
      ? (await getAllCloudOrders({ productId: record.productId }))
        .filter((item) => item.kind === 'activity')
      : [];
    if (initialOrders.length > MAX_ACTIVITY_CAPACITY_BOOTSTRAP_ORDERS) {
      throw new ActivityCapacityInitializationError();
    }
    return (getCloudDatabase() as CloudDatabaseWithTransactions).runTransaction(async (transaction) => {
      const collection = transaction.collection(config.shopOrderCollection);
      const orderDocument = collection.doc(record.id);
      const orderResponse = await orderDocument.get();
      const storedOrder = getTransactionOrder(orderResponse.data);
      if (storedOrder) return clone(normalizeOrder(storedOrder));

      const capacityDocument = collection.doc(getActivityCapacityDocumentId(record.productId));
      const capacityResponse = await capacityDocument.get();
      const storedCapacity = getTransactionCapacity(capacityResponse.data);
      const hasCapacityRecord = isActivityCapacityRecord(storedCapacity, record.productId);
      const reservations = hasCapacityRecord
        ? buildActiveCapacityReservations(storedCapacity, [])
        : new Map<string, ActivityCapacityReservation>();
      const bootstrapDocuments: CloudTransactionDocument[] = [];

      if (!hasCapacityRecord) {
        if (!needsBootstrap) throw new ActivityCapacityInitializationError();
        // 首次启用容量账本时，在事务中逐单复核事务外快照；随后会给每个历史订单写迁移标记，
        // 让并发状态更新形成写冲突并自动重试，避免幽灵占位。后续仅以容量账本为权威源。
        for (const initialOrder of initialOrders) {
          const initialDocument = collection.doc(initialOrder.id);
          const initialResponse = await initialDocument.get();
          const initialData = getTransactionOrder(initialResponse.data);
          if (!initialData) continue;
          bootstrapDocuments.push(initialDocument);
          const latestInitialOrder = normalizeOrder(initialData);
          if (latestInitialOrder.kind !== 'activity' || latestInitialOrder.productId !== record.productId) continue;
          const initialReservation = getOrderCapacityReservation(latestInitialOrder);
          if (initialReservation) mergeCapacityReservation(reservations, initialReservation);
        }
      }
      const existingOpenidReservation = findExistingOpenidReservation(reservations, record);
      if (existingOpenidReservation) {
        const existingResponse = await collection.doc(existingOpenidReservation.orderId).get();
        const existingOrderData = getTransactionOrder(existingResponse.data);
        if (existingOrderData) {
          const existingOrder = normalizeOrder(existingOrderData);
          if (getOrderCapacityReservation(existingOrder)) return clone(existingOrder);
        }
        reservations.delete(existingOpenidReservation.orderId);
      }
      const reservation = getOrderCapacityReservation(record);
      const additionalReservationCount = reservation && !reservations.has(record.id) ? 1 : 0;
      if (
        maxParticipants > 0
        && currentParticipants + reservations.size + additionalReservationCount > maxParticipants
      ) {
        throw new ActivityCapacityExceededError();
      }
      if (reservation) mergeCapacityReservation(reservations, reservation);

      const updatedAt = now();
      for (const bootstrapDocument of bootstrapDocuments) {
        await bootstrapDocument.update({ capacityLedgerMigratedAt: updatedAt });
      }
      await capacityDocument.set(buildActivityCapacityRecord(record.productId, reservations, updatedAt));
      await collection.add({ ...record, _id: record.id });
      return clone(record);
    });
  }

  loadOrders();
  const duplicate = store.orders.find((item) => item.id === record.id);
  if (duplicate) return clone(duplicate);

  const activityOrders = store.orders.filter((item) => (
    item.kind === 'activity' && item.productId === record.productId
  ));
  const reservations = buildActiveCapacityReservations(undefined, activityOrders);
  const existingOpenidReservation = findExistingOpenidReservation(reservations, record);
  if (existingOpenidReservation) {
    const existingOrder = store.orders.find((item) => item.id === existingOpenidReservation.orderId);
    if (existingOrder && getOrderCapacityReservation(existingOrder)) return clone(existingOrder);
    reservations.delete(existingOpenidReservation.orderId);
  }
  const reservation = getOrderCapacityReservation(record);
  const additionalReservationCount = reservation && !reservations.has(record.id) ? 1 : 0;
  if (
    maxParticipants > 0
    && currentParticipants + reservations.size + additionalReservationCount > maxParticipants
  ) {
    throw new ActivityCapacityExceededError();
  }

  store.orders.unshift(record);
  persistOrders();
  return clone(record);
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  if (usesCloudbaseStorage()) {
    const record = await getCloudOrderById(orderId);
    return record ? clone(record) : null;
  }

  loadOrders();
  const record = store.orders.find((item) => item.id === sanitizeString(orderId)) ?? null;
  return record ? clone(record) : null;
}

export async function getOrdersByOpenid(openid: string, kind?: OrderKind): Promise<OrderRecord[]> {
  const normalizedOpenid = sanitizeString(openid);
  if (!normalizedOpenid) return [];

  if (usesCloudbaseStorage()) {
    const orders = (await getAllCloudOrders({ openid: normalizedOpenid }))
      .filter((item) => !kind || item.kind === kind);
    return clone(orders.sort((first, second) => (
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
    )));
  }

  loadOrders();
  return clone(
    store.orders
      .filter((item) => item.openid === normalizedOpenid && (!kind || item.kind === kind))
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
  );
}

export async function getOrdersByProductId(productId: string, kind?: OrderKind): Promise<OrderRecord[]> {
  const normalizedProductId = sanitizeString(productId);
  if (!normalizedProductId) return [];

  if (usesCloudbaseStorage()) {
    const orders = (await getAllCloudOrders({ productId: normalizedProductId }))
      .filter((item) => !kind || item.kind === kind);
    return clone(orders);
  }

  loadOrders();
  return clone(store.orders.filter((item) => (
    item.productId === normalizedProductId && (!kind || item.kind === kind)
  )));
}

export async function getOrdersByKind(kind: OrderKind): Promise<OrderRecord[]> {
  if (usesCloudbaseStorage()) {
    return clone((await getAllCloudOrders({ kind }))
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()));
  }

  loadOrders();
  return clone(store.orders
    .filter((item) => item.kind === kind)
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()));
}

export interface PaymentPreparationClaim {
  claimed: boolean;
  order: OrderRecord | null;
}

function hasActivePaymentPreparation(order: OrderRecord) {
  const preparingUntil = Date.parse(order.paymentPreparingUntil);
  return Boolean(
    order.paymentPreparationToken
    && Number.isFinite(preparingUntil)
    && preparingUntil > Date.now()
  );
}

export async function claimOrderPaymentPreparation(
  orderId: string,
  token: string,
  leaseMilliseconds: number,
): Promise<PaymentPreparationClaim> {
  const normalizedOrderId = sanitizeString(orderId);
  const normalizedToken = sanitizeString(token);
  const preparingUntil = new Date(Date.now() + Math.max(1_000, leaseMilliseconds)).toISOString();

  if (usesCloudbaseStorage()) {
    await ensureCloudCollection();
    return (getCloudDatabase() as CloudDatabaseWithTransactions).runTransaction(async (transaction) => {
      const document = transaction.collection(config.shopOrderCollection).doc(normalizedOrderId);
      const response = await document.get();
      const stored = getTransactionOrder(response.data);
      if (!stored) return { claimed: false, order: null };

      const current = normalizeOrder(stored);
      if (current.status !== 'pending' || current.prepayId || hasActivePaymentPreparation(current)) {
        return { claimed: false, order: clone(current) };
      }

      const updatedAt = now();
      await document.update({
        paymentPreparationToken: normalizedToken,
        paymentPreparingUntil: preparingUntil,
        updatedAt,
      });
      return {
        claimed: true,
        order: clone(normalizeOrder({
          ...current,
          paymentPreparationToken: normalizedToken,
          paymentPreparingUntil: preparingUntil,
          updatedAt,
        })),
      };
    });
  }

  loadOrders();
  const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
  if (index === -1) return { claimed: false, order: null };

  const current = store.orders[index];
  if (current.status !== 'pending' || current.prepayId || hasActivePaymentPreparation(current)) {
    return { claimed: false, order: clone(current) };
  }

  store.orders[index] = normalizeOrder({
    ...current,
    paymentPreparationToken: normalizedToken,
    paymentPreparingUntil: preparingUntil,
    updatedAt: now(),
  });
  persistOrders();
  return { claimed: true, order: clone(store.orders[index]) };
}

export async function finishOrderPaymentPreparation(
  orderId: string,
  token: string,
  input: Pick<OrderRecord, 'prepayId' | 'failureReason'>,
): Promise<OrderRecord | null> {
  const normalizedOrderId = sanitizeString(orderId);
  const normalizedToken = sanitizeString(token);

  if (usesCloudbaseStorage()) {
    await ensureCloudCollection();
    return (getCloudDatabase() as CloudDatabaseWithTransactions).runTransaction(async (transaction) => {
      const document = transaction.collection(config.shopOrderCollection).doc(normalizedOrderId);
      const response = await document.get();
      const stored = getTransactionOrder(response.data);
      if (!stored) return null;

      const current = normalizeOrder(stored);
      if (current.prepayId || current.status !== 'pending') return clone(current);
      if (current.paymentPreparationToken !== normalizedToken) return clone(current);

      const updatedAt = now();
      const update = {
        prepayId: sanitizeString(input.prepayId),
        failureReason: sanitizeString(input.failureReason),
        paymentPreparationToken: '',
        paymentPreparingUntil: '',
        updatedAt,
      };
      await document.update(update);
      return clone(normalizeOrder({ ...current, ...update }));
    });
  }

  loadOrders();
  const index = store.orders.findIndex((item) => item.id === normalizedOrderId);
  if (index === -1) return null;

  const current = store.orders[index];
  if (current.prepayId || current.status !== 'pending') return clone(current);
  if (current.paymentPreparationToken !== normalizedToken) return clone(current);

  store.orders[index] = normalizeOrder({
    ...current,
    prepayId: sanitizeString(input.prepayId),
    failureReason: sanitizeString(input.failureReason),
    paymentPreparationToken: '',
    paymentPreparingUntil: '',
    updatedAt: now(),
  });
  persistOrders();
  return clone(store.orders[index]);
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
  if (usesCloudbaseStorage()) {
    await ensureCloudCollection();
    return (getCloudDatabase() as CloudDatabaseWithTransactions).runTransaction(async (transaction) => {
      const collection = transaction.collection(config.shopOrderCollection);
      const document = collection.doc(orderId);
      const response = await document.get();
      const stored = getTransactionOrder(response.data);
      if (!stored) return null;
      const latest = normalizeOrder(stored);
      if (latest.status === 'paid' && status !== 'paid') return clone(latest);

      const capacityDocument = latest.kind === 'activity'
        ? collection.doc(getActivityCapacityDocumentId(latest.productId))
        : null;
      const capacityResponse = capacityDocument ? await capacityDocument.get() : null;
      const storedCapacity = capacityResponse ? getTransactionCapacity(capacityResponse.data) : undefined;
      const updatedAt = now();
      const next = normalizeOrder({
        ...latest,
        status,
        transactionId: options.transactionId || latest.transactionId,
        paidAt: status === 'paid' ? (options.paidAt || latest.paidAt || updatedAt) : latest.paidAt,
        failureReason: options.failureReason ?? latest.failureReason,
        lastNotifyId: options.notifyId || latest.lastNotifyId,
        paymentPreparationToken: status === 'pending' ? latest.paymentPreparationToken : '',
        paymentPreparingUntil: status === 'pending' ? latest.paymentPreparingUntil : '',
        updatedAt,
      });
      await document.update({
        status: next.status,
        transactionId: next.transactionId,
        paidAt: next.paidAt,
        failureReason: next.failureReason,
        lastNotifyId: next.lastNotifyId,
        paymentPreparationToken: next.paymentPreparationToken,
        paymentPreparingUntil: next.paymentPreparingUntil,
        updatedAt: next.updatedAt,
      });

      if (
        capacityDocument
        && storedCapacity?.recordType === ACTIVITY_CAPACITY_RECORD_TYPE
        && sanitizeString(storedCapacity.activityId) === latest.productId
      ) {
        const reservations = buildActiveCapacityReservations(storedCapacity, []);
        const reservation = getOrderCapacityReservation(next);
        if (reservation) {
          mergeCapacityReservation(reservations, reservation);
        } else {
          reservations.delete(next.id);
        }
        await capacityDocument.set(buildActivityCapacityRecord(latest.productId, reservations, updatedAt));
      }
      return clone(next);
    });
  }

  loadOrders();
  const index = store.orders.findIndex((item) => item.id === orderId);
  if (index === -1) return null;

  const current = store.orders[index];
  if (current.status === 'paid' && status !== 'paid') {
    return clone(current);
  }

  const next: OrderRecord = normalizeOrder({
    ...current,
    status,
    transactionId: options.transactionId || current.transactionId,
    paidAt: status === 'paid' ? (options.paidAt || current.paidAt || now()) : current.paidAt,
    failureReason: options.failureReason ?? current.failureReason,
    lastNotifyId: options.notifyId || current.lastNotifyId,
    paymentPreparationToken: status === 'pending' ? current.paymentPreparationToken : '',
    paymentPreparingUntil: status === 'pending' ? current.paymentPreparingUntil : '',
    updatedAt: now(),
  });
  store.orders[index] = next;
  persistOrders();
  return clone(next);
}

export async function settleFreeOrder(order: OrderRecord): Promise<OrderRecord> {
  if (order.amount !== 0 || order.status !== 'pending') return clone(order);
  const transactionId = `${order.kind === 'activity' ? 'FREE_ACTIVITY' : 'FREE_SHOP'}_${order.id}`;
  const paidAt = now();
  const settled = await updateOrderStatus(order.id, 'paid', { transactionId, paidAt });
  if (!settled) throw new Error('订单不存在');
  return settled;
}

export function getOrderStorageType() {
  return config.shopOrderStorage;
}

export async function checkOrderStorageReady(): Promise<boolean> {
  if (!usesCloudbaseStorage()) return config.cloudMode !== 'cloudrun' || config.allowEphemeralCloudrunData;
  try {
    await ensureCloudCollection();
    return true;
  } catch (error) {
    console.error('[orders store] cloudbase readiness error', getCloudErrorText(error));
    return false;
  }
}
