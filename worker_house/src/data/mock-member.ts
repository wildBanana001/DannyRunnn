import Taro from '@tarojs/taro';
import { allActivities, featuredActivity } from '@/data/activities';
import type { Activity, CardOrder, CardUsageLog, Profile, ProfileFormValue, ProfileSnapshot, Registration } from '@/types';

const STORAGE_KEY = 'worker-house-member-state-v5';
const DEFAULT_OPENID = 'mock_openid_001';
const CARD_PACKAGE_PRICE = 399;
const CARD_MAX_DEDUCTION = 148;
const CARD_PACKAGE_COUNT = 3;

interface WorkerHouseMockState {
  profiles: Profile[];
  registrations: Registration[];
  cardOrder: CardOrder | null;
  cardUsageLogs: CardUsageLog[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const sortByDateDesc = <T extends { registeredAt?: string; purchasedAt?: string; usedAt?: string; updatedAt?: string }>(list: T[]) => {
  return [...list].sort((prev, next) => {
    const prevTime = new Date(prev.registeredAt || prev.purchasedAt || prev.usedAt || prev.updatedAt || '').getTime();
    const nextTime = new Date(next.registeredAt || next.purchasedAt || next.usedAt || next.updatedAt || '').getTime();
    return nextTime - prevTime;
  });
};

const getActivitySnapshot = (activityId?: string): Activity => {
  if (!activityId) {
    return featuredActivity;
  }
  return allActivities.find((item) => item.id === activityId) ?? featuredActivity;
};

const ensureDefaultProfile = (profiles: Profile[]): Profile[] => {
  const sortedProfiles = sortByDateDesc(profiles);
  if (sortedProfiles.length === 0) {
    return [];
  }

  const defaultProfile = sortedProfiles.find((item) => item.isDefault) ?? sortedProfiles[0];
  return sortedProfiles.map((item) => ({
    ...item,
    isDefault: item.id === defaultProfile.id,
  }));
};

const buildProfileSnapshot = (profile: Profile): ProfileSnapshot => ({
  nickname: profile.nickname,
  gender: profile.gender,
  ageRange: profile.ageRange,
  industry: profile.industry,
  occupation: profile.occupation,
  city: profile.city,
  socialGoal: profile.socialGoal,
  introduction: profile.introduction,
});

const normalizeCardOrder = (cardOrder: CardOrder | null, usageLogs: CardUsageLog[]): CardOrder | null => {
  if (!cardOrder) {
    return null;
  }

  const totalCount = Math.max(cardOrder.totalCount || CARD_PACKAGE_COUNT, 0);
  const usedCount = Math.max(0, Math.min(cardOrder.usedCount || 0, totalCount));
  const remainingCount = Math.max(0, cardOrder.remainingCount ?? totalCount - usedCount);

  return {
    ...cardOrder,
    totalCount,
    usedCount,
    remainingCount,
    usageLogs: sortByDateDesc(usageLogs),
    status: remainingCount > 0 ? 'active' : 'used_up',
  };
};

const normalizeRegistrations = (registrations: Registration[]): Registration[] => {
  return sortByDateDesc(
    registrations.map((item) => ({
      ...item,
      activity: item.activity ?? getActivitySnapshot(item.activityId),
      activityCover: item.activityCover || getActivitySnapshot(item.activityId).cover || getActivitySnapshot(item.activityId).coverImage,
    }))
  );
};

const buildSeedProfile = (): Profile => ({
  id: 'profile-default-001',
  openid: DEFAULT_OPENID,
  nickname: '凯锋',
  gender: 'male',
  ageRange: '95 后',
  industry: '互联网内容策略',
  occupation: '内容策略负责人',
  city: '上海',
  socialGoal: '想认识也愿意认真生活、愿意一起做点小手作和散步的人。',
  introduction: '白天在电脑前写方案，晚上想靠旧物、聊天和手作把自己慢慢捞回来。第一次来 worker house，想认识一些也愿意认真生活的人。',
  wechatName: 'Linkaifeng',
  phone: '13800000000',
  tags: ['拼贴', '手作', '城市散步'],
  isDefault: true,
  createdAt: '2026-04-15T11:20:00Z',
  updatedAt: '2026-04-20T09:00:00Z',
});

const buildSeedState = (): WorkerHouseMockState => {
  const profile = buildSeedProfile();
  const activity = getActivitySnapshot('act-001');
  const usageLog: CardUsageLog = {
    id: 'card-log-20260418001',
    registrationId: 'registration-20260418001',
    activityId: activity.id,
    activityTitle: activity.title,
    usedAt: '2026-04-18T20:05:00Z',
    deductionCount: 1,
    deductionAmount: 148,
    operatorName: '系统',
    status: 'used',
    note: '用于报名活动时抵扣次卡。',
  };
  const cardOrder: CardOrder = {
    id: 'card-order-20260410001',
    openid: DEFAULT_OPENID,
    profileId: profile.id,
    userNickname: profile.nickname,
    userWechatName: profile.wechatName,
    cardType: '3 次社畜次卡',
    totalCount: CARD_PACKAGE_COUNT,
    usedCount: 1,
    remainingCount: 2,
    amount: CARD_PACKAGE_PRICE,
    purchasedAt: '2026-04-10T10:00:00Z',
    status: 'active',
    usageLogs: [usageLog],
    expiresAt: '2026-10-10T00:00:00Z',
  };
  const registration: Registration = {
    id: 'registration-20260418001',
    activityId: activity.id,
    activityTitle: activity.title,
    activityCover: activity.cover || activity.coverImage,
    profileId: profile.id,
    participantNickname: profile.nickname,
    wechatName: profile.wechatName,
    phone: profile.phone,
    useCard: true,
    originalPrice: activity.price,
    cardOffset: 148,
    payable: Math.max(0, activity.price - 148),
    deductionAmount: 148,
    amountPaid: Math.max(0, activity.price - 148),
    status: 'pending',
    registeredAt: '2026-04-18T19:46:00Z',
    profileSnapshot: buildProfileSnapshot(profile),
    cardOrderId: cardOrder.id,
    cardUsageLogId: usageLog.id,
    activity,
  };

  return {
    profiles: [profile],
    registrations: [registration],
    cardOrder,
    cardUsageLogs: [usageLog],
  };
};

const normalizeState = (state: WorkerHouseMockState): WorkerHouseMockState => {
  const profiles = ensureDefaultProfile(state.profiles || []);
  const cardUsageLogs = sortByDateDesc(state.cardUsageLogs || []);
  return {
    profiles,
    registrations: normalizeRegistrations(state.registrations || []),
    cardOrder: normalizeCardOrder(state.cardOrder, cardUsageLogs),
    cardUsageLogs,
  };
};

const persistState = (state: WorkerHouseMockState): WorkerHouseMockState => {
  const normalized = normalizeState(state);
  Taro.setStorageSync(STORAGE_KEY, normalized);
  return normalized;
};

export const getMockMemberState = (): WorkerHouseMockState => {
  const cached = Taro.getStorageSync(STORAGE_KEY);
  if (cached && typeof cached === 'object') {
    return normalizeState(cached as WorkerHouseMockState);
  }
  return persistState(buildSeedState());
};

const setMockMemberState = (updater: (prev: WorkerHouseMockState) => WorkerHouseMockState): WorkerHouseMockState => {
  const nextState = updater(clone(getMockMemberState()));
  return persistState(nextState);
};

const buildProfileFromFormValue = (payload: ProfileFormValue, current?: Profile): Profile => {
  const now = new Date().toISOString();
  return {
    id: current?.id || `profile-${Date.now()}`,
    openid: current?.openid || DEFAULT_OPENID,
    nickname: (payload.nickname || '').trim() || '未命名档案',
    gender: payload.gender,
    ageRange: (payload.ageRange || '').trim(),
    industry: (payload.industry || '').trim(),
    occupation: (payload.occupation || '').trim(),
    city: (payload.city || '').trim(),
    socialGoal: (payload.socialGoal || '').trim(),
    introduction: (payload.introduction || '').trim(),
    wechatName: (payload.wechatName || '').trim(),
    phone: (payload.phone || '').trim() || undefined,
    tags: (payload.tags || []).map((item) => item.trim()).filter(Boolean),
    isDefault: payload.isDefault ?? current?.isDefault ?? false,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };
};

export const calculateCardDeduction = (price: number, useCard: boolean, cardEligible: boolean, remaining: number): number => {
  if (!useCard || !cardEligible || remaining <= 0) {
    return 0;
  }
  return Math.min(price, CARD_MAX_DEDUCTION);
};

export const getMockProfiles = (): Profile[] => getMockMemberState().profiles;

export const upsertMockProfile = (payload: ProfileFormValue & { id?: string }): Profile => {
  let savedProfileId = payload.id || '';

  const nextState = setMockMemberState((prev) => {
    const current = prev.profiles.find((item) => item.id === payload.id);
    const nextProfile = buildProfileFromFormValue(payload, current);
    savedProfileId = nextProfile.id;
    const exists = prev.profiles.some((item) => item.id === nextProfile.id);
    const nextProfiles = exists
      ? prev.profiles.map((item) => (item.id === nextProfile.id ? nextProfile : item))
      : [nextProfile, ...prev.profiles];

    prev.profiles = ensureDefaultProfile(
      nextProfiles.map((item) => ({
        ...item,
        isDefault: nextProfile.isDefault ? item.id === nextProfile.id : item.isDefault,
      }))
    );
    return prev;
  });

  return nextState.profiles.find((item) => item.id === savedProfileId) || nextState.profiles[0];
};

export const deleteMockProfile = (id: string): Profile[] => {
  return setMockMemberState((prev) => {
    prev.profiles = ensureDefaultProfile(prev.profiles.filter((item) => item.id !== id));
    return prev;
  }).profiles;
};

export const setMockDefaultProfile = (id: string): Profile[] => {
  return setMockMemberState((prev) => {
    prev.profiles = ensureDefaultProfile(prev.profiles.map((item) => ({ ...item, isDefault: item.id === id })));
    return prev;
  }).profiles;
};

export const getMockRegistrations = (): Registration[] => getMockMemberState().registrations;

export const getMockRegistrationDetail = (id: string): Registration | null => {
  return getMockRegistrations().find((item) => item.id === id) ?? null;
};

export const getMockCurrentCard = (): CardOrder | null => getMockMemberState().cardOrder;

export const getMockCardUsageLogs = (): CardUsageLog[] => getMockMemberState().cardUsageLogs;

export const buyMockCard = (): CardOrder => {
  const nextState = setMockMemberState((prev) => {
    const now = new Date().toISOString();
    const profile = prev.profiles.find((item) => item.isDefault) ?? prev.profiles[0] ?? buildSeedProfile();
    const currentCard = normalizeCardOrder(prev.cardOrder, prev.cardUsageLogs);

    if (currentCard) {
      prev.cardOrder = {
        ...currentCard,
        totalCount: currentCard.totalCount + CARD_PACKAGE_COUNT,
        remainingCount: currentCard.remainingCount + CARD_PACKAGE_COUNT,
        amount: currentCard.amount + CARD_PACKAGE_PRICE,
        usageLogs: prev.cardUsageLogs,
      };
      return prev;
    }

    prev.cardOrder = {
      id: `card-order-${Date.now()}`,
      openid: DEFAULT_OPENID,
      profileId: profile.id,
      userNickname: profile.nickname,
      userWechatName: profile.wechatName,
      cardType: '3 次社畜次卡',
      totalCount: CARD_PACKAGE_COUNT,
      usedCount: 0,
      remainingCount: CARD_PACKAGE_COUNT,
      amount: CARD_PACKAGE_PRICE,
      purchasedAt: now,
      status: 'active',
      usageLogs: [],
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
    };
    return prev;
  });

  return nextState.cardOrder as CardOrder;
};

interface CreateRegistrationPayload {
  activityId: string;
  profileId: string;
  useCard: boolean;
}

export const createMockRegistration = (payload: CreateRegistrationPayload): Registration => {
  const nextState = setMockMemberState((prev) => {
    const profile = prev.profiles.find((item) => item.id === payload.profileId) ?? prev.profiles[0] ?? buildSeedProfile();
    const activity = getActivitySnapshot(payload.activityId);
    const currentCard = normalizeCardOrder(prev.cardOrder, prev.cardUsageLogs);
    const deductionAmount = calculateCardDeduction(activity.price, payload.useCard, Boolean(activity.cardEligible), currentCard?.remainingCount || 0);
    const payable = Math.max(0, activity.price - deductionAmount);
    const now = new Date().toISOString();

    const registration: Registration = {
      id: `registration-${Date.now()}`,
      activityId: activity.id,
      activityTitle: activity.title,
      activityCover: activity.cover || activity.coverImage,
      profileId: profile.id,
      participantNickname: profile.nickname,
      wechatName: profile.wechatName,
      phone: profile.phone,
      useCard: deductionAmount > 0,
      originalPrice: activity.price,
      cardOffset: deductionAmount,
      payable,
      deductionAmount,
      amountPaid: payable,
      status: payable > 0 ? 'pending' : 'confirmed',
      registeredAt: now,
      profileSnapshot: buildProfileSnapshot(profile),
      activity,
      cardOrderId: currentCard?.id,
    };

    prev.registrations = [registration, ...prev.registrations];

    if (deductionAmount > 0 && currentCard) {
      const usageLog: CardUsageLog = {
        id: `card-log-${Date.now()}`,
        registrationId: registration.id,
        activityId: activity.id,
        activityTitle: activity.title,
        usedAt: now,
        deductionCount: 1,
        deductionAmount,
        operatorName: '系统',
        status: 'used',
        note: '报名成功后自动扣减 1 次次卡。',
      };
      prev.cardUsageLogs = [usageLog, ...prev.cardUsageLogs];
      prev.cardOrder = {
        ...currentCard,
        usedCount: currentCard.usedCount + 1,
        remainingCount: Math.max(0, currentCard.remainingCount - 1),
        usageLogs: [usageLog, ...prev.cardUsageLogs],
      };
      registration.cardUsageLogId = usageLog.id;
    }

    return prev;
  });

  return nextState.registrations[0];
};
