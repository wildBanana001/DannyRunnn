import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { activitySeedData } from '../mock/seed.js';
import type { ActivityRecord, ActivitySignupRecord } from '../types/index.js';
import {
  deleteMysqlActivity,
  getMysqlActivityById,
  initializeMysqlActivityCatalog,
  listMysqlActivities,
  upsertMysqlActivity,
} from './mysql-catalogs.js';

interface ActivityStoreState {
  activities: ActivityRecord[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const configuredStorageFilePath = process.env.ACTIVITY_CATALOG_FILE?.trim();
const storageFilePath = configuredStorageFilePath
  ? path.resolve(configuredStorageFilePath)
  : path.join(currentDir, 'activities.store.json');

const activityStore: ActivityStoreState = {
  activities: [],
};
let mysqlCatalogInitialized = false;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function requireActivityImage(value: unknown, field: string) {
  const image = requireActivityString(value, field);
  if (!image.startsWith('/static/') && !/^https:\/\//i.test(image)) invalidActivity(field);
  return image;
}

function requireActivityImageArray(value: unknown, field: string) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) invalidActivity(field);
  const images = value.map((item) => {
    if (typeof item !== 'string') invalidActivity(field);
    return requireActivityImage(item, field);
  });
  return images;
}

export class ActivityCatalogValidationError extends Error {
  readonly code = 'ACTIVITY_CATALOG_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'ActivityCatalogValidationError';
  }
}

export function isActivityCatalogValidationError(error: unknown): boolean {
  if (error instanceof ActivityCatalogValidationError) return true;
  if (!error || typeof error !== 'object') return false;
  const input = error as { code?: unknown; name?: unknown };
  return input.code === 'ACTIVITY_CATALOG_INVALID'
    || input.name === 'ActivityCatalogValidationError';
}

export class ActivityCatalogStorageError extends Error {
  readonly code = 'ACTIVITY_CATALOG_STORAGE_INVALID';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ActivityCatalogStorageError';
  }
}

export function isActivityCatalogStorageError(error: unknown): boolean {
  if (error instanceof ActivityCatalogStorageError) return true;
  if (!error || typeof error !== 'object') return false;
  const input = error as { code?: unknown; name?: unknown };
  return input.code === 'ACTIVITY_CATALOG_STORAGE_INVALID'
    || input.name === 'ActivityCatalogStorageError';
}

function invalidActivity(field: string): never {
  throw new ActivityCatalogValidationError(`活动字段无效或缺失：${field}`);
}

function requireActivityString(value: unknown, field: string) {
  const normalized = sanitizeString(value);
  if (!normalized) invalidActivity(field);
  return normalized;
}

function requireActivityMoney(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalidActivity(field);
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 1e-8) invalidActivity(field);
  return value;
}

function requireActivityInteger(value: unknown, field: string, minimum: number) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    invalidActivity(field);
  }
  return value;
}

function requireActivityDate(value: unknown, field: string) {
  const normalized = requireActivityString(value, field);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) invalidActivity(field);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    invalidActivity(field);
  }
  return normalized;
}

function requireActivityTime(value: unknown, field: string) {
  const normalized = requireActivityString(value, field);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)) invalidActivity(field);
  return normalized;
}

function createActivityId() {
  return `act-${randomUUID().slice(0, 8)}`;
}

function createSignupId() {
  return `signup-${randomUUID().slice(0, 8)}`;
}

function sortActivities(list: ActivityRecord[]) {
  return [...list].sort((first, second) => {
    const secondTime = new Date(second.startDate || second.createdAt).getTime();
    const firstTime = new Date(first.startDate || first.createdAt).getTime();
    return secondTime - firstTime;
  });
}

function deriveActivityStatus(startDate: string, endDate: string, endTime: string) {
  const normalizedEndTime = /^\d{2}:\d{2}$/.test(endTime) ? endTime : '23:59';
  const endTimestamp = Date.parse(`${endDate || startDate}T${normalizedEndTime}:00+08:00`);
  if (Number.isFinite(endTimestamp) && Date.now() >= endTimestamp) {
    return 'ended' as const;
  }
  return 'ongoing' as const;
}

export function normalizeActivityRecord(record: Partial<ActivityRecord>): ActivityRecord {
  const id = requireActivityString(record.id, 'id');
  const title = requireActivityString(record.title, 'title');
  const description = sanitizeString(record.description) || sanitizeString(record.fullDescription);
  if (!description) invalidActivity('description');
  const fullDescription = sanitizeString(record.fullDescription) || description;
  const inputCovers = requireActivityImageArray(record.covers, 'covers');
  const inputGallery = requireActivityImageArray(record.gallery, 'gallery');
  const explicitCoverImage = record.coverImage === undefined
    ? ''
    : requireActivityImage(record.coverImage, 'coverImage');
  const explicitCover = record.cover === undefined
    ? ''
    : requireActivityImage(record.cover, 'cover');
  const coverImage = explicitCoverImage
    || explicitCover
    || inputGallery[0]
    || inputCovers[0];
  if (!coverImage) invalidActivity('coverImage');
  const cover = explicitCover || coverImage;
  const covers = Array.from(
    new Set([cover, coverImage, ...inputCovers, ...inputGallery]),
  );
  const gallery = Array.from(new Set([...inputGallery, ...covers]));
  const startDate = requireActivityDate(record.startDate, 'startDate');
  const endDate = requireActivityDate(record.endDate, 'endDate');
  const startTime = requireActivityTime(record.startTime, 'startTime');
  const endTime = requireActivityTime(record.endTime, 'endTime');
  const startTimestamp = Date.parse(`${startDate}T${startTime}:00+08:00`);
  const endTimestamp = Date.parse(`${endDate}T${endTime}:00+08:00`);
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || endTimestamp <= startTimestamp) {
    invalidActivity('dateRange');
  }
  const price = requireActivityMoney(record.price, 'price');
  const originalPrice = requireActivityMoney(record.originalPrice, 'originalPrice');
  const maxParticipants = requireActivityInteger(record.maxParticipants, 'maxParticipants', 1);
  const currentParticipants = requireActivityInteger(record.currentParticipants, 'currentParticipants', 0);
  if (currentParticipants > maxParticipants) invalidActivity('currentParticipants');
  if (typeof record.enabled !== 'boolean') invalidActivity('enabled');
  if (typeof record.cardEligible !== 'boolean') invalidActivity('cardEligible');
  const createdAt = requireActivityString(record.createdAt, 'createdAt');
  const updatedAt = requireActivityString(record.updatedAt, 'updatedAt');
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) {
    invalidActivity('timestamps');
  }
  const signups = Array.isArray(record.signups) ? clone(record.signups) : [];
  const status = deriveActivityStatus(startDate, endDate, endTime);
  const sort = record.sort === undefined
    ? 0
    : requireActivityInteger(record.sort, 'sort', 0);

  return {
    id,
    title,
    description,
    fullDescription,
    cover,
    coverImage,
    covers,
    gallery,
    startDate,
    endDate,
    startTime,
    endTime,
    location: requireActivityString(record.location, 'location'),
    address: sanitizeString(record.address) || undefined,
    price,
    originalPrice,
    maxParticipants,
    currentParticipants,
    status,
    category: requireActivityString(record.category, 'category'),
    tags: sanitizeStringArray(record.tags),
    cardEligible: record.cardEligible,
    hostId: sanitizeString(record.hostId),
    hostName: sanitizeString(record.hostName),
    hostAvatar: sanitizeString(record.hostAvatar),
    hostDescription: sanitizeString(record.hostDescription),
    venueName: sanitizeString(record.venueName) || requireActivityString(record.location, 'location'),
    venueDescription: sanitizeString(record.venueDescription),
    venueImages: sanitizeStringArray(record.venueImages),
    requirements: sanitizeStringArray(record.requirements),
    includes: sanitizeStringArray(record.includes),
    refundPolicy: sanitizeString(record.refundPolicy),
    signups,
    createdAt,
    updatedAt,
    enabled: record.enabled,
    sort,
  };
}

function persistActivities() {
  if (config.shopOrderStorage === 'mysql') {
    throw new Error('MySQL 活动目录禁止写入容器文件');
  }
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(activityStore.activities, null, 2), 'utf-8');
}

function loadActivities() {
  if (config.shopOrderStorage === 'mysql') {
    if (!mysqlCatalogInitialized) throw new Error('MySQL 活动目录尚未初始化');
    return;
  }
  if (activityStore.activities.length > 0) {
    return;
  }

  const fallbackActivities = sortActivities(activitySeedData.map((item) => normalizeActivityRecord(item)));

  if (!existsSync(storageFilePath)) {
    activityStore.activities = fallbackActivities;
    persistActivities();
    return;
  }

  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as ActivityRecord[];
    if (!Array.isArray(parsed)) {
      throw new Error('活动数据格式错误');
    }
    activityStore.activities = sortActivities(parsed.map((item) => normalizeActivityRecord(item)));
  } catch (error) {
    // An existing store is operational data, not a seed source. Replacing a
    // malformed file with bundled saleable activities would silently invent
    // prices/capacity and make them public, so fail closed and leave it intact.
    throw new ActivityCatalogStorageError('本地活动目录损坏，已拒绝回退到内置种子', { cause: error });
  }
}

function buildActivityRecord(input: Partial<ActivityRecord>, current?: ActivityRecord) {
  const timestamp = now();
  const nextRecord: Partial<ActivityRecord> = current
    ? {
        ...clone(current),
        ...input,
        // IDs, timestamps and signup data are server-owned. In particular, a
        // POST body ID must never reach MySQL's upsert key.
        createdAt: current.createdAt,
        id: current.id,
        signups: clone(current.signups ?? []),
        updatedAt: timestamp,
      }
    : {
        ...input,
        createdAt: timestamp,
        id: createActivityId(),
        signups: [],
        sort: input.sort ?? activityStore.activities.length + 1,
        updatedAt: timestamp,
      };

  // Creation deliberately has no activity template. Every sale-critical field
  // (including enabled, prices, capacity, images and schedule) must be explicit.
  return normalizeActivityRecord(nextRecord);
}

if (config.shopOrderStorage !== 'mysql') loadActivities();

function replaceCachedActivity(activity: ActivityRecord) {
  const exists = activityStore.activities.some((item) => item.id === activity.id);
  activityStore.activities = sortActivities(
    exists
      ? activityStore.activities.map((item) => item.id === activity.id ? activity : item)
      : [activity, ...activityStore.activities],
  );
}

function readActivitySeedData() {
  const fallbackActivities = sortActivities(activitySeedData.map((item) => normalizeActivityRecord(item)));
  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as ActivityRecord[];
    if (!Array.isArray(parsed)) throw new Error('活动种子数据格式错误');
    return sortActivities(parsed.map((item) => normalizeActivityRecord(item)));
  } catch (error) {
    console.warn('[activities] bundled seed unavailable, using built-in seed', error instanceof Error ? error.message : error);
    return fallbackActivities;
  }
}

export async function initializeActivityCatalog() {
  if (config.shopOrderStorage !== 'mysql') {
    loadActivities();
    return listActivities();
  }

  const records = await initializeMysqlActivityCatalog(readActivitySeedData());
  try {
    activityStore.activities = sortActivities(records.map((item) => normalizeActivityRecord(item)));
  } catch (error) {
    throw new ActivityCatalogStorageError('MySQL 活动目录包含无效记录', { cause: error });
  }
  mysqlCatalogInitialized = true;
  return listActivities();
}

export async function listPersistedActivities() {
  if (config.shopOrderStorage !== 'mysql') return listActivities();
  const records = await listMysqlActivities();
  try {
    activityStore.activities = sortActivities(records.map((item) => normalizeActivityRecord(item)));
  } catch (error) {
    throw new ActivityCatalogStorageError('MySQL 活动目录包含无效记录', { cause: error });
  }
  mysqlCatalogInitialized = true;
  return listActivities();
}

export async function getPersistedActivityById(activityId: string) {
  if (config.shopOrderStorage !== 'mysql') return getActivityById(activityId);
  const record = await getMysqlActivityById(activityId);
  if (!record) {
    activityStore.activities = activityStore.activities.filter((item) => item.id !== activityId);
    return null;
  }
  let normalized: ActivityRecord;
  try {
    normalized = normalizeActivityRecord(record);
  } catch (error) {
    throw new ActivityCatalogStorageError(`MySQL 活动 ${activityId} 配置无效`, { cause: error });
  }
  replaceCachedActivity(normalized);
  mysqlCatalogInitialized = true;
  return clone(normalized);
}

export function listActivities() {
  loadActivities();
  // 状态按每次读取时的北京时间重新计算，长驻实例跨过结束时间后也会立即下架报名。
  return clone(sortActivities(activityStore.activities.map((item) => normalizeActivityRecord(item))));
}

export function getActivityById(activityId: string) {
  loadActivities();
  const record = activityStore.activities.find((item) => item.id === activityId) ?? null;
  return record ? clone(normalizeActivityRecord(record)) : null;
}

export function upsertActivity(activityId: undefined, input: Partial<ActivityRecord>): ActivityRecord;
export function upsertActivity(activityId: string, input: Partial<ActivityRecord>): ActivityRecord | null;
export function upsertActivity(
  activityId: string | undefined,
  input: Partial<ActivityRecord>,
): ActivityRecord | null;
export function upsertActivity(activityId: string | undefined, input: Partial<ActivityRecord>) {
  if (config.shopOrderStorage === 'mysql') {
    throw new Error('MySQL 活动目录必须使用异步持久化写接口');
  }
  loadActivities();
  const current = activityId ? activityStore.activities.find((item) => item.id === activityId) : undefined;
  if (activityId && !current) return null;
  const nextRecord = buildActivityRecord(input, current);

  activityStore.activities = current
    ? activityStore.activities.map((item) => (item.id === current.id ? nextRecord : item))
    : sortActivities([nextRecord, ...activityStore.activities]);

  persistActivities();
  return clone(nextRecord);
}

export function upsertPersistedActivity(
  activityId: undefined,
  input: Partial<ActivityRecord>,
): Promise<ActivityRecord>;
export function upsertPersistedActivity(
  activityId: string,
  input: Partial<ActivityRecord>,
): Promise<ActivityRecord | null>;
export function upsertPersistedActivity(
  activityId: string | undefined,
  input: Partial<ActivityRecord>,
): Promise<ActivityRecord | null>;
export async function upsertPersistedActivity(activityId: string | undefined, input: Partial<ActivityRecord>) {
  if (config.shopOrderStorage !== 'mysql') return upsertActivity(activityId, input);
  if (!mysqlCatalogInitialized) await initializeActivityCatalog();
  const current = activityId ? await getPersistedActivityById(activityId) : undefined;
  if (activityId && !current) return null;
  if (!activityId) await listPersistedActivities();
  const nextRecord = buildActivityRecord(input, current ?? undefined);
  await upsertMysqlActivity(nextRecord);
  replaceCachedActivity(nextRecord);
  return clone(nextRecord);
}

export function deleteActivity(activityId: string) {
  if (config.shopOrderStorage === 'mysql') {
    throw new Error('MySQL 活动目录必须使用异步持久化删除接口');
  }
  loadActivities();
  const existed = activityStore.activities.some((item) => item.id === activityId);
  if (!existed) {
    return false;
  }

  activityStore.activities = activityStore.activities.filter((item) => item.id !== activityId);
  persistActivities();
  return true;
}

export async function deletePersistedActivity(activityId: string) {
  if (config.shopOrderStorage !== 'mysql') return deleteActivity(activityId);
  const deleted = await deleteMysqlActivity(activityId);
  if (deleted) activityStore.activities = activityStore.activities.filter((item) => item.id !== activityId);
  return deleted;
}

export function registerActivityParticipant(activityId: string, signup: Omit<ActivitySignupRecord, 'createdAt' | 'id'>) {
  if (config.shopOrderStorage === 'mysql') {
    throw new Error('生产活动报名必须使用 MySQL 支付订单，不写活动目录 signups');
  }
  loadActivities();
  const current = activityStore.activities.find((item) => item.id === activityId);
  if (!current) {
    return null;
  }

  const record: ActivitySignupRecord = {
    ...signup,
    id: createSignupId(),
    createdAt: now(),
    status: signup.status || 'confirmed',
  };

  const nextRecord = normalizeActivityRecord({
    ...current,
    currentParticipants: current.currentParticipants + 1,
    signups: [...(current.signups ?? []), record],
    updatedAt: now(),
  });

  activityStore.activities = activityStore.activities.map((item) => (item.id === activityId ? nextRecord : item));
  persistActivities();
  return clone(nextRecord);
}

export function removeActivityParticipantsByOpenid(openid: string) {
  if (config.shopOrderStorage === 'mysql') {
    throw new Error('MySQL 活动目录必须使用异步账号清理接口');
  }
  loadActivities();
  const normalizedOpenid = sanitizeString(openid);
  if (!normalizedOpenid) return 0;

  let removed = 0;
  const nextActivities = activityStore.activities.map((activity) => {
    const signups = activity.signups ?? [];
    const remainingSignups = signups.filter(
      (signup) => sanitizeString(signup.openid) !== normalizedOpenid,
    );
    const removedFromActivity = signups.length - remainingSignups.length;
    if (removedFromActivity === 0) return activity;

    removed += removedFromActivity;
    return normalizeActivityRecord({
      ...activity,
      currentParticipants: Math.max(0, activity.currentParticipants - removedFromActivity),
      signups: remainingSignups,
      updatedAt: now(),
    });
  });

  if (removed > 0) {
    activityStore.activities = nextActivities;
    persistActivities();
  }
  return removed;
}

export async function removePersistedActivityParticipantsByOpenid(openid: string) {
  if (config.shopOrderStorage !== 'mysql') return removeActivityParticipantsByOpenid(openid);
  const normalizedOpenid = sanitizeString(openid);
  if (!normalizedOpenid) return 0;

  const activities = await listPersistedActivities();
  let removed = 0;
  for (const activity of activities) {
    const signups = activity.signups ?? [];
    const remainingSignups = signups.filter((signup) => sanitizeString(signup.openid) !== normalizedOpenid);
    const removedFromActivity = signups.length - remainingSignups.length;
    if (removedFromActivity === 0) continue;
    removed += removedFromActivity;
    const nextRecord = normalizeActivityRecord({
      ...activity,
      currentParticipants: Math.max(0, activity.currentParticipants - removedFromActivity),
      signups: remainingSignups,
      updatedAt: now(),
    });
    await upsertMysqlActivity(nextRecord);
    replaceCachedActivity(nextRecord);
  }
  return removed;
}
