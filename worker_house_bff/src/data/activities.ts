import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activitySeedData } from '../mock/seed.js';
import type { ActivityRecord, ActivitySignupRecord } from '../types/index.js';

interface ActivityStoreState {
  activities: ActivityRecord[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'activities.store.json');
const defaultActivityTemplate = structuredClone(activitySeedData[0]);

const activityStore: ActivityStoreState = {
  activities: [],
};

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

function sanitizeNumber(value: unknown, fallback: number) {
  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
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

function deriveActivityStatus(startDate: string, endDate: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (endDate && endDate < today) {
    return 'ended' as const;
  }
  if (startDate && startDate > today) {
    return 'ongoing' as const;
  }
  return 'ongoing' as const;
}

function normalizeActivityRecord(record: ActivityRecord): ActivityRecord {
  const coverImage = sanitizeString(record.coverImage || record.cover || record.gallery?.[0] || record.covers?.[0] || '')
    || defaultActivityTemplate.coverImage;
  const cover = sanitizeString(record.cover || coverImage) || coverImage;
  const covers = Array.from(
    new Set([cover, coverImage, ...(record.covers ?? []), ...(record.gallery ?? [])].map((item) => sanitizeString(item)).filter(Boolean)),
  );
  const gallery = Array.from(new Set([...(record.gallery ?? []), ...covers].map((item) => sanitizeString(item)).filter(Boolean)));
  const startDate = sanitizeString(record.startDate) || defaultActivityTemplate.startDate;
  const endDate = sanitizeString(record.endDate) || startDate;
  const signups = Array.isArray(record.signups) ? clone(record.signups) : [];

  return {
    ...defaultActivityTemplate,
    ...record,
    id: sanitizeString(record.id) || createActivityId(),
    title: sanitizeString(record.title) || defaultActivityTemplate.title,
    description: sanitizeString(record.description) || sanitizeString(record.fullDescription) || defaultActivityTemplate.description,
    fullDescription: sanitizeString(record.fullDescription) || sanitizeString(record.description) || defaultActivityTemplate.fullDescription,
    cover,
    coverImage,
    covers,
    gallery,
    startDate,
    endDate,
    startTime: sanitizeString(record.startTime) || defaultActivityTemplate.startTime,
    endTime: sanitizeString(record.endTime) || defaultActivityTemplate.endTime,
    location: sanitizeString(record.location) || defaultActivityTemplate.location,
    address: sanitizeString(record.address) || undefined,
    price: sanitizeNumber(record.price, defaultActivityTemplate.price),
    originalPrice: sanitizeNumber(record.originalPrice, sanitizeNumber(record.price, defaultActivityTemplate.originalPrice ?? defaultActivityTemplate.price)),
    maxParticipants: Math.max(1, sanitizeNumber(record.maxParticipants, defaultActivityTemplate.maxParticipants)),
    currentParticipants: Math.max(0, sanitizeNumber(record.currentParticipants, 0)),
    status: deriveActivityStatus(startDate, endDate),
    category: sanitizeString(record.category) || defaultActivityTemplate.category,
    tags: sanitizeStringArray(record.tags),
    cardEligible: Boolean(record.cardEligible),
    hostId: sanitizeString(record.hostId) || defaultActivityTemplate.hostId,
    hostName: sanitizeString(record.hostName) || defaultActivityTemplate.hostName,
    hostAvatar: sanitizeString(record.hostAvatar) || defaultActivityTemplate.hostAvatar,
    hostDescription: sanitizeString(record.hostDescription) || defaultActivityTemplate.hostDescription,
    venueName: sanitizeString(record.venueName) || sanitizeString(record.location) || defaultActivityTemplate.venueName,
    venueDescription: sanitizeString(record.venueDescription) || defaultActivityTemplate.venueDescription,
    venueImages: sanitizeStringArray(record.venueImages),
    requirements: sanitizeStringArray(record.requirements),
    includes: sanitizeStringArray(record.includes),
    refundPolicy: sanitizeString(record.refundPolicy) || defaultActivityTemplate.refundPolicy,
    signups,
    createdAt: sanitizeString(record.createdAt) || now(),
    updatedAt: sanitizeString(record.updatedAt) || sanitizeString(record.createdAt) || now(),
    enabled: record.enabled ?? true,
    sort: sanitizeNumber(record.sort, defaultActivityTemplate.sort ?? 0),
  };
}

function persistActivities() {
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(activityStore.activities, null, 2), 'utf-8');
}

function loadActivities() {
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
  } catch {
    activityStore.activities = fallbackActivities;
    persistActivities();
  }
}

function buildActivityRecord(input: Partial<ActivityRecord>, current?: ActivityRecord) {
  const baseRecord: ActivityRecord = current
    ? clone(current)
    : {
        ...clone(defaultActivityTemplate),
        createdAt: now(),
        currentParticipants: 0,
        id: createActivityId(),
        signups: [],
        sort: listActivities().length + 1,
        updatedAt: now(),
      };

  const nextRecord = normalizeActivityRecord({
    ...baseRecord,
    ...input,
    cardEligible: input.cardEligible ?? baseRecord.cardEligible,
    createdAt: baseRecord.createdAt,
    currentParticipants: input.currentParticipants ?? baseRecord.currentParticipants,
    address: input.address ?? current?.address,
    id: current?.id ?? (sanitizeString(input.id) || baseRecord.id),
    signups: Array.isArray(input.signups) ? input.signups : baseRecord.signups,
    updatedAt: now(),
  });

  return nextRecord;
}

loadActivities();

export function listActivities() {
  loadActivities();
  return clone(activityStore.activities);
}

export function getActivityById(activityId: string) {
  loadActivities();
  const record = activityStore.activities.find((item) => item.id === activityId) ?? null;
  return clone(record);
}

export function upsertActivity(activityId: string | undefined, input: Partial<ActivityRecord>) {
  loadActivities();
  const current = activityId ? activityStore.activities.find((item) => item.id === activityId) : undefined;
  const nextRecord = buildActivityRecord(input, current);

  activityStore.activities = current
    ? activityStore.activities.map((item) => (item.id === current.id ? nextRecord : item))
    : sortActivities([nextRecord, ...activityStore.activities]);

  persistActivities();
  return clone(nextRecord);
}

export function deleteActivity(activityId: string) {
  loadActivities();
  const existed = activityStore.activities.some((item) => item.id === activityId);
  if (!existed) {
    return false;
  }

  activityStore.activities = activityStore.activities.filter((item) => item.id !== activityId);
  persistActivities();
  return true;
}

export function registerActivityParticipant(activityId: string, signup: Omit<ActivitySignupRecord, 'createdAt' | 'id'>) {
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
