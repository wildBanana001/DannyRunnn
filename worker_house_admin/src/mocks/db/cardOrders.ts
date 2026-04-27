import dayjs from 'dayjs';
import type { CardOrder, CardUsageLog } from '@/types';
import { activitySeedData } from '@/mocks/db/activities';
import { profileSeedData } from '@/mocks/db/profiles';

const activityMap = new Map(activitySeedData.map((activity) => [activity.id, activity] as const));
const profileMap = new Map(profileSeedData.map((profile) => [profile.id, profile] as const));

function getActivityTitle(activityId: string) {
  return activityMap.get(activityId)?.title ?? '未知活动';
}

function createUsageLog(input: Omit<CardUsageLog, 'activityTitle'>): CardUsageLog {
  return {
    ...input,
    activityTitle: getActivityTitle(input.activityId),
  };
}

function createCardOrder(
  input: Omit<CardOrder, 'remainingCount' | 'usedCount' | 'userNickname' | 'userWechatName'>,
) {
  const profile = profileMap.get(input.profileId);
  const usedCount = input.usageLogs
    .filter((item) => item.status === 'used')
    .reduce((total, item) => total + item.deductionCount, 0);

  return {
    ...input,
    userNickname: profile?.nickname ?? '未知用户',
    userWechatName: profile?.wechatName ?? '--',
    usedCount,
    remainingCount: Math.max(input.totalCount - usedCount, 0),
  } satisfies CardOrder;
}

export const cardOrderSeedData: CardOrder[] = [
  createCardOrder({
    id: 'card-order-001',
    profileId: 'profile-001',
    cardType: '社畜次卡 · 5 次轻享卡',
    totalCount: 5,
    amount: 799,
    purchasedAt: '2026-04-08T09:20:00Z',
    status: 'active',
    expiresAt: '2026-08-08T00:00:00Z',
    usageLogs: [
      createUsageLog({
        id: 'usage-001',
        activityId: 'act-006',
        usedAt: '2026-04-10T11:30:00Z',
        deductionCount: 1,
        deductionAmount: 100,
        operatorName: '运营-孟夏',
        status: 'used',
        note: '报名日式花道体验时使用 1 次。',
      }),
      createUsageLog({
        id: 'usage-002',
        activityId: 'act-001',
        usedAt: '2026-04-21T12:18:00Z',
        deductionCount: 1,
        deductionAmount: 120,
        operatorName: '运营-孟夏',
        status: 'used',
        note: '用于山野疗愈瑜伽 retreat 抵扣。',
      }),
    ],
  }),
  createCardOrder({
    id: 'card-order-002',
    profileId: 'profile-003',
    cardType: '社畜次卡 · 10 次进阶卡',
    totalCount: 10,
    amount: 1399,
    purchasedAt: '2026-03-28T05:42:00Z',
    status: 'active',
    expiresAt: '2026-09-28T00:00:00Z',
    usageLogs: [
      createUsageLog({
        id: 'usage-003',
        activityId: 'act-003',
        usedAt: '2026-04-05T01:35:00Z',
        deductionCount: 1,
        deductionAmount: 100,
        operatorName: '运营-嘉言',
        status: 'used',
        note: '陶艺手作体验报名抵扣。',
      }),
      createUsageLog({
        id: 'usage-004',
        activityId: 'act-005',
        usedAt: '2026-04-12T10:00:00Z',
        deductionCount: 1,
        deductionAmount: 80,
        operatorName: '运营-嘉言',
        status: 'used',
        note: '摄影 walk 周末场次使用。',
      }),
      createUsageLog({
        id: 'usage-005',
        activityId: 'act-007',
        usedAt: '2026-04-24T11:30:00Z',
        deductionCount: 1,
        deductionAmount: 100,
        operatorName: '运营-嘉言',
        status: 'used',
        note: '红酒品鉴与配餐艺术预订使用。',
      }),
      createUsageLog({
        id: 'usage-006',
        activityId: 'act-010',
        usedAt: '2026-04-25T14:20:00Z',
        deductionCount: 1,
        deductionAmount: 80,
        operatorName: '运营-嘉言',
        status: 'reverted',
        note: '用户改期后回退 1 次。',
      }),
    ],
  }),
  createCardOrder({
    id: 'card-order-003',
    profileId: 'profile-006',
    cardType: '社畜次卡 · 3 次体验卡',
    totalCount: 3,
    amount: 499,
    purchasedAt: '2026-02-26T08:50:00Z',
    status: 'expired',
    expiresAt: '2026-04-26T00:00:00Z',
    usageLogs: [
      createUsageLog({
        id: 'usage-007',
        activityId: 'act-002',
        usedAt: '2026-03-02T12:00:00Z',
        deductionCount: 1,
        deductionAmount: 80,
        operatorName: '运营-若谷',
        status: 'used',
        note: '咖啡美学课报名抵扣。',
      }),
      createUsageLog({
        id: 'usage-008',
        activityId: 'act-004',
        usedAt: '2026-03-29T06:20:00Z',
        deductionCount: 1,
        deductionAmount: 120,
        operatorName: '运营-若谷',
        status: 'used',
        note: '甜点烘焙课使用 1 次。',
      }),
      createUsageLog({
        id: 'usage-009',
        activityId: 'act-008',
        usedAt: '2026-04-16T09:10:00Z',
        deductionCount: 1,
        deductionAmount: 100,
        operatorName: '运营-若谷',
        status: 'used',
        note: '油画写生下午茶活动预留名额。',
      }),
    ],
  }),
  createCardOrder({
    id: 'card-order-004',
    profileId: 'profile-002',
    cardType: '社畜次卡 · 5 次轻享卡',
    totalCount: 5,
    amount: 799,
    purchasedAt: '2026-04-12T03:16:00Z',
    status: 'refunded',
    expiresAt: '2026-08-12T00:00:00Z',
    usageLogs: [],
  }),
];

const cardOrders = [...cardOrderSeedData];

export function listCardOrders() {
  return [...cardOrders].sort(
    (first, second) => dayjs(second.purchasedAt).valueOf() - dayjs(first.purchasedAt).valueOf(),
  );
}
