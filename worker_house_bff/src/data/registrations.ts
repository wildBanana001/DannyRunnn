import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getActivityById, registerActivityParticipant } from './activities.js';
import { applyCardUsage, findUsableCardOrder } from './cardOrders.js';
import { buildProfileSnapshot, resolveProfileForRegistration } from './profiles.js';
import { registrationSeedData } from './seed.js';
import { clone, memoryStore, now } from './store.js';
import type { Registration, RegistrationStatus } from '../types/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'registrations.store.json');

interface CreateRegistrationInput {
  activityId?: string;
  cardOrderId?: string;
  phone?: string;
  profileId?: string;
  useCard?: boolean;
  wechatName?: string;
}

interface RegistrationListFilters {
  activityId?: string;
  status?: RegistrationStatus;
}

function createId() {
  return `reg-${randomUUID().slice(0, 8)}`;
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sortRegistrations(list: Registration[]) {
  return [...list].sort((first, second) => {
    const secondTime = new Date(second.createdAt || second.registeredAt).getTime();
    const firstTime = new Date(first.createdAt || first.registeredAt).getTime();
    return secondTime - firstTime;
  });
}

function normalizeRegistrationStatus(status: unknown): RegistrationStatus {
  const normalizedStatus = sanitizeString(status);
  if (normalizedStatus === 'confirmed' || normalizedStatus === 'cancelled' || normalizedStatus === 'completed' || normalizedStatus === 'refunded') {
    return normalizedStatus;
  }
  return 'pending';
}

function normalizeRegistration(record: Partial<Registration>): Registration {
  const registeredAt = sanitizeString(record.registeredAt) || sanitizeString(record.createdAt) || now();
  return {
    id: sanitizeString(record.id) || createId(),
    openid: sanitizeString(record.openid) || '',
    activityId: sanitizeString(record.activityId) || '',
    activityTitle: sanitizeString(record.activityTitle) || '未命名活动',
    activityCover: sanitizeString(record.activityCover) || '',
    profileId: sanitizeString(record.profileId) || '',
    participantNickname: sanitizeString(record.participantNickname) || '未命名用户',
    wechatName: sanitizeString(record.wechatName) || '',
    phone: sanitizeString(record.phone) || undefined,
    useCard: Boolean(record.useCard),
    originalPrice: Math.max(0, Number(record.originalPrice ?? 0)),
    cardOffset: Math.max(0, Number(record.cardOffset ?? record.deductionAmount ?? 0)),
    payable: Math.max(0, Number(record.payable ?? 0)),
    deductionAmount: Math.max(0, Number(record.deductionAmount ?? record.cardOffset ?? 0)),
    amountPaid: Math.max(0, Number(record.amountPaid ?? record.payable ?? 0)),
    status: normalizeRegistrationStatus(record.status),
    registeredAt,
    createdAt: sanitizeString(record.createdAt) || registeredAt,
    updatedAt: sanitizeString(record.updatedAt) || registeredAt,
    profileSnapshot: record.profileSnapshot
      ? clone(record.profileSnapshot)
      : {
          nickname: sanitizeString(record.participantNickname) || '未命名用户',
          gender: 'other',
          ageRange: '',
          industry: '',
          occupation: '',
          city: '',
          socialGoal: '',
          introduction: '',
        },
    cardOrderId: sanitizeString(record.cardOrderId) || undefined,
    cardUsageLogId: sanitizeString(record.cardUsageLogId) || undefined,
  };
}

function persistRegistrations() {
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(memoryStore.registrations, null, 2), 'utf-8');
}

function loadRegistrations() {
  if (memoryStore.registrations.length > 0) {
    return;
  }

  if (!existsSync(storageFilePath)) {
    memoryStore.registrations = sortRegistrations(registrationSeedData.map((item) => normalizeRegistration(item)));
    persistRegistrations();
    return;
  }

  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as Partial<Registration>[];
    if (!Array.isArray(parsed)) {
      throw new Error('报名数据格式错误');
    }
    memoryStore.registrations = sortRegistrations(parsed.map((item) => normalizeRegistration(item)));
  } catch {
    memoryStore.registrations = sortRegistrations(registrationSeedData.map((item) => normalizeRegistration(item)));
    persistRegistrations();
  }
}

export function calculateCardOffset({
  cardEligible,
  maxOffset,
  price,
  remaining,
  useCard,
}: {
  cardEligible: boolean;
  maxOffset: number;
  price: number;
  remaining: number;
  useCard: boolean;
}) {
  if (!useCard || !cardEligible || remaining <= 0) {
    return 0;
  }
  return Math.min(price, Math.max(0, maxOffset));
}

function listRegistrationsByOpenidUnsafe(filters: RegistrationListFilters = {}) {
  loadRegistrations();
  return memoryStore.registrations.filter((item) => {
    if (filters.activityId && item.activityId !== filters.activityId) {
      return false;
    }
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    return true;
  });
}

loadRegistrations();

export function listRegistrationsByOpenid(openid: string, filters: RegistrationListFilters = {}) {
  loadRegistrations();
  const list = memoryStore.registrations.filter((item) => item.openid === openid);
  const filtered = list.filter((item) => {
    if (filters.activityId && item.activityId !== filters.activityId) {
      return false;
    }
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    return true;
  });

  return clone(sortRegistrations(filtered));
}

export function listAllRegistrations(filters: RegistrationListFilters = {}) {
  return clone(sortRegistrations(listRegistrationsByOpenidUnsafe(filters)));
}

export function getRegistrationById(openid: string, registrationId: string) {
  loadRegistrations();
  const record = memoryStore.registrations.find((item) => item.openid === openid && item.id === registrationId) ?? null;
  return clone(record ? normalizeRegistration(record) : null);
}

export function getRegistrationByIdUnsafe(registrationId: string) {
  loadRegistrations();
  const record = memoryStore.registrations.find((item) => item.id === registrationId) ?? null;
  return clone(record ? normalizeRegistration(record) : null);
}

export function updateRegistrationStatus(registrationId: string, status: RegistrationStatus) {
  loadRegistrations();
  const current = memoryStore.registrations.find((item) => item.id === registrationId);
  if (!current) {
    return null;
  }

  const nextRecord = normalizeRegistration({
    ...current,
    status,
    updatedAt: now(),
  });
  memoryStore.registrations = sortRegistrations(memoryStore.registrations.map((item) => (item.id === registrationId ? nextRecord : item)));
  persistRegistrations();
  return clone(nextRecord);
}

export function createRegistration(openid: string, input: CreateRegistrationInput) {
  loadRegistrations();
  const activityId = sanitizeString(input.activityId);
  if (!activityId) {
    throw new Error('缺少活动 ID');
  }

  const activity = getActivityById(activityId);
  if (!activity) {
    throw new Error('活动不存在');
  }

  if (activity.maxParticipants > 0 && activity.currentParticipants >= activity.maxParticipants) {
    throw new Error('活动名额已满');
  }

  const profile = resolveProfileForRegistration(openid, sanitizeString(input.profileId) || undefined);
  if (!profile) {
    throw new Error('请先创建用户档案');
  }

  const useCard = Boolean(input.useCard);
  const requestedCardOrderId = sanitizeString(input.cardOrderId) || undefined;
  const usableCardOrder = useCard
    ? findUsableCardOrder(openid, profile.id, requestedCardOrderId)
    : null;
  const remaining = usableCardOrder?.remainingCount ?? 0;
  const originalPrice = activity.price;
  const cardOffset = calculateCardOffset({
    useCard,
    cardEligible: Boolean(activity.cardEligible),
    remaining,
    price: originalPrice,
    maxOffset: usableCardOrder?.perUseMaxOffset ?? 148,
  });
  const payable = Math.max(0, originalPrice - cardOffset);
  const registrationId = createId();
  const participantNickname = profile.nickname;
  const wechatName = sanitizeString(input.wechatName) || profile.wechatName;
  const phone = sanitizeString(input.phone) || profile.phone;

  let cardUsageResult: ReturnType<typeof applyCardUsage> = null;
  if (cardOffset > 0) {
    cardUsageResult = applyCardUsage({
      openid,
      profileId: profile.id,
      cardOrderId: usableCardOrder?.id,
      activityId: activity.id,
      activityTitle: activity.title,
      deductionAmount: cardOffset,
      operatorName: '系统',
      registrationId,
      note: '创建报名时自动抵扣',
    });
  }

  const status: RegistrationStatus = payable > 0 ? 'pending' : 'confirmed';
  const timestamp = now();
  const record = normalizeRegistration({
    id: registrationId,
    openid,
    activityId: activity.id,
    activityTitle: activity.title,
    activityCover: activity.cover || activity.coverImage,
    profileId: profile.id,
    participantNickname,
    wechatName,
    phone,
    useCard,
    originalPrice,
    cardOffset,
    payable,
    deductionAmount: cardOffset,
    amountPaid: payable,
    status,
    registeredAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    profileSnapshot: buildProfileSnapshot(profile),
    cardOrderId: cardUsageResult?.order.id,
    cardUsageLogId: cardUsageResult?.usageLog.id,
  });

  memoryStore.registrations = sortRegistrations([record, ...memoryStore.registrations]);
  persistRegistrations();

  registerActivityParticipant(activity.id, {
    nickname: participantNickname,
    phone: phone ?? '',
    wechatId: wechatName,
    openid,
  });

  return clone(record);
}
