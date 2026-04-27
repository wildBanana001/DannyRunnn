import dayjs from 'dayjs';
import type { Activity, Profile, ProfileSnapshot, Registration } from '@/types';
import { activitySeedData } from '@/mocks/db/activities';
import { profileSeedData } from '@/mocks/db/profiles';

const activityMap = new Map(activitySeedData.map((activity) => [activity.id, activity] as const));
const profileMap = new Map(profileSeedData.map((profile) => [profile.id, profile] as const));

function getActivityOrThrow(id: string) {
  const activity = activityMap.get(id);

  if (!activity) {
    throw new Error(`未找到活动：${id}`);
  }

  return activity;
}

function getProfileOrThrow(id: string) {
  const profile = profileMap.get(id);

  if (!profile) {
    throw new Error(`未找到档案：${id}`);
  }

  return profile;
}

function createProfileSnapshot(profile: Profile): ProfileSnapshot {
  return {
    nickname: profile.nickname,
    gender: profile.gender,
    ageRange: profile.ageRange,
    industry: profile.industry,
    occupation: profile.occupation,
    city: profile.city,
    socialGoal: profile.socialGoal,
    introduction: profile.introduction,
  };
}

function createRegistrationRecord(input: {
  activityId: string;
  amountPaid?: number;
  deductionAmount?: number;
  id: string;
  phone?: string;
  profileId: string;
  registeredAt: string;
  status: Registration['status'];
  useCard: boolean;
}): Registration {
  const activity: Activity = getActivityOrThrow(input.activityId);
  const profile = getProfileOrThrow(input.profileId);
  const deductionAmount = input.deductionAmount ?? 0;
  const amountPaid = input.amountPaid ?? Math.max(activity.price - deductionAmount, 0);

  return {
    id: input.id,
    activityId: activity.id,
    activityTitle: activity.title,
    profileId: profile.id,
    participantNickname: profile.nickname,
    wechatName: profile.wechatName,
    phone: input.phone ?? profile.phone,
    useCard: input.useCard,
    originalPrice: activity.price,
    deductionAmount,
    amountPaid,
    status: input.status,
    registeredAt: input.registeredAt,
    profileSnapshot: createProfileSnapshot(profile),
  };
}

export const registrationSeedData: Registration[] = [
  createRegistrationRecord({
    id: 'reg-001',
    activityId: 'act-001',
    profileId: 'profile-001',
    registeredAt: '2026-04-21T12:16:00Z',
    status: 'confirmed',
    useCard: true,
    deductionAmount: 120,
  }),
  createRegistrationRecord({
    id: 'reg-002',
    activityId: 'act-001',
    profileId: 'profile-002',
    registeredAt: '2026-04-22T03:40:00Z',
    status: 'pending',
    useCard: false,
  }),
  createRegistrationRecord({
    id: 'reg-003',
    activityId: 'act-007',
    profileId: 'profile-003',
    registeredAt: '2026-04-24T11:28:00Z',
    status: 'completed',
    useCard: true,
    deductionAmount: 100,
  }),
  createRegistrationRecord({
    id: 'reg-004',
    activityId: 'act-010',
    profileId: 'profile-004',
    registeredAt: '2026-04-25T08:05:00Z',
    status: 'confirmed',
    useCard: false,
  }),
  createRegistrationRecord({
    id: 'reg-005',
    activityId: 'act-009',
    profileId: 'profile-005',
    registeredAt: '2026-04-25T23:45:00Z',
    status: 'completed',
    useCard: false,
  }),
  createRegistrationRecord({
    id: 'reg-006',
    activityId: 'act-008',
    profileId: 'profile-006',
    registeredAt: '2026-04-26T01:12:00Z',
    status: 'cancelled',
    useCard: false,
    amountPaid: 0,
  }),
];

const registrations = [...registrationSeedData];

export function listRegistrations() {
  return [...registrations].sort(
    (first, second) => dayjs(second.registeredAt).valueOf() - dayjs(first.registeredAt).valueOf(),
  );
}
