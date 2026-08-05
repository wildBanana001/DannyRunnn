import { Router } from 'express';
import { config } from '../config.js';
import {
  deleteActivity,
  getActivityById,
  listActivities,
  registerActivityParticipant,
  upsertActivity,
} from '../data/activities.js';
import { getOrdersByKind } from '../data/orders.js';
import { authMiddleware } from '../middleware/auth.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import type { ActivityRecord } from '../types/index.js';

function parsePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function activityTime(activity: ActivityRecord) {
  return new Date(`${activity.startDate}T${activity.startTime || '00:00'}:00+08:00`).getTime();
}

function getPublicActivity(activityId: string) {
  const activity = getActivityById(activityId);
  return activity && activity.enabled !== false ? toPublicActivity(activity) : null;
}

function toPublicActivity(activity: ActivityRecord): ActivityRecord {
  const { signups: _privateSignups, ...publicActivity } = activity;
  return publicActivity;
}

async function withPaidRegistrationCounts(activities: ActivityRecord[]) {
  try {
    const paidCounts = new Map<string, number>();
    for (const order of await getOrdersByKind('activity')) {
      if (order.status !== 'paid') continue;
      paidCounts.set(order.productId, (paidCounts.get(order.productId) ?? 0) + 1);
    }
    return activities.map((activity) => ({
      ...activity,
      currentParticipants: activity.currentParticipants + (paidCounts.get(activity.id) ?? 0),
    }));
  } catch (error) {
    console.warn(
      '[activities] load paid registration counts failed',
      error instanceof Error ? error.message : error,
    );
    return activities;
  }
}

export const activityRouter = Router();

// 公开展示与报名支付共用 BFF 活动目录，避免列表、详情和支付价格来自不同数据源。
activityRouter.get('/', async (request, response) => {
  const page = parsePage(request.query.page, 1);
  const pageSize = Math.min(parsePage(request.query.pageSize, 10), 100);
  const rawStatus = typeof request.query.status === 'string' ? request.query.status.trim() : '';
  const type = typeof request.query.type === 'string' ? request.query.type.trim() : '';
  const status = type === 'past' && !rawStatus ? 'ended' : rawStatus;
  const keyword = typeof request.query.keyword === 'string' ? request.query.keyword.trim().toLowerCase() : '';

  let list = (await withPaidRegistrationCounts(listActivities().map(toPublicActivity)))
    .filter((item) => item.enabled !== false);
  if (status) {
    list = list.filter((item) => item.status === status);
  }
  if (keyword) {
    list = list.filter((item) =>
      [item.title, item.description, ...item.tags].some((value) => value.toLowerCase().includes(keyword)),
    );
  }

  list.sort((first, second) =>
    status === 'ended'
      ? activityTime(second) - activityTime(first)
      : activityTime(first) - activityTime(second),
  );

  const startIndex = (page - 1) * pageSize;
  response.json({
    list: list.slice(startIndex, startIndex + pageSize),
    total: list.length,
  });
});

activityRouter.post('/', authMiddleware, (request, response) => {
  const record = upsertActivity(undefined, request.body as Partial<ActivityRecord>);
  response.status(201).json(record);
});

activityRouter.get('/:id', async (request, response) => {
  const activity = getPublicActivity(String(request.params.id));
  if (!activity) {
    response.status(404).json({ message: '活动不存在或已下架' });
    return;
  }
  response.json((await withPaidRegistrationCounts([activity]))[0]);
});

activityRouter.put('/:id', authMiddleware, (request, response) => {
  const activityId = String(request.params.id);
  if (!getActivityById(activityId)) {
    response.status(404).json({ message: '活动不存在' });
    return;
  }
  response.json(upsertActivity(activityId, request.body as Partial<ActivityRecord>));
});

activityRouter.delete('/:id', authMiddleware, (request, response) => {
  if (!deleteActivity(String(request.params.id))) {
    response.status(404).json({ message: '活动不存在' });
    return;
  }
  response.json({ success: true });
});

activityRouter.post('/:id/signup', wxCloudrunAuth, (request, response) => {
  if (config.cloudMode !== 'mock') {
    response.status(410).json({ message: '活动报名已改为微信支付，请使用活动支付接口' });
    return;
  }

  const nickname = String(request.body?.nickname ?? '').trim();
  const phone = String(request.body?.phone ?? '').trim();
  const wechatId = String(request.body?.wechatId ?? '').trim();
  if (!nickname || !phone || !wechatId) {
    response.status(400).json({ message: '报名信息不完整' });
    return;
  }

  const activityId = String(request.params.id);
  const currentActivity = getPublicActivity(activityId);
  if (!currentActivity || currentActivity.status === 'ended') {
    response.status(404).json({ message: '活动不存在、已结束或已下架' });
    return;
  }

  const activity = registerActivityParticipant(activityId, {
    nickname,
    openid: request.wxUser?.openid,
    phone,
    status: 'confirmed',
    unionid: request.wxUser?.unionid,
    wechatId,
  });
  if (!activity) {
    response.status(404).json({ message: '活动不存在' });
    return;
  }
  response.json(toPublicActivity(activity));
});
