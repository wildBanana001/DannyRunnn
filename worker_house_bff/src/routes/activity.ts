import { Router } from 'express';
import { callCloudFunction, normalizeActivity } from '../cloudClient.js';
import { authMiddleware, resolveRequestToken } from '../middleware/auth.js';
import type { ActivityRecord } from '../mock/types.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';

function parsePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fetchActivityDetail(id: string) {
  const detailResult = await callCloudFunction<Record<string, unknown>>('activity', {
    action: 'get',
    id,
  });

  if (!detailResult.success) {
    return detailResult;
  }

  const activity = normalizeActivity(detailResult.data);
  if (!activity) {
    return { success: false as const, error: '活动不存在' };
  }

  return { success: true as const, data: activity };
}

export const activityRouter = Router();

activityRouter.get('/', async (request, response) => {
  const page = parsePage(request.query.page, 1);
  const pageSize = parsePage(request.query.pageSize, 10);
  const rawStatus = typeof request.query.status === 'string' ? request.query.status : undefined;
  const type = typeof request.query.type === 'string' ? request.query.type : undefined;
  const status = type === 'past' && !rawStatus ? 'ended' : rawStatus;
  const keyword = typeof request.query.keyword === 'string' ? request.query.keyword.trim().toLowerCase() : '';

  try {
    const result = await callCloudFunction<Record<string, unknown>[]>('activity', {
      action: 'list',
      status,
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    let list = result.data
      .map((item) => normalizeActivity(item))
      .filter((item): item is ActivityRecord => Boolean(item));

    if (status) {
      list = list.filter((item) => item.status === status);
    }

    if (keyword) {
      list = list.filter((item) => item.title.toLowerCase().includes(keyword));
    }

    list = list.sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );

    const startIndex = (page - 1) * pageSize;
    response.json({
      list: list.slice(startIndex, startIndex + pageSize),
      total: list.length,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取活动列表失败' });
  }
});

activityRouter.post('/', authMiddleware, async (request, response) => {
  try {
    const result = await callCloudFunction<{ id: string }>('activity', {
      action: 'create',
      data: request.body,
      token: resolveRequestToken(request),
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const detail = await fetchActivityDetail(result.data.id);
    if (!detail.success) {
      response.status(400).json({ message: detail.error });
      return;
    }

    response.json(detail.data);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '创建活动失败' });
  }
});

activityRouter.get('/:id', async (request, response) => {
  try {
    const result = await fetchActivityDetail(String(request.params.id));

    if (!result.success) {
      response.status(404).json({ message: result.error });
      return;
    }

    response.json(result.data);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取活动详情失败' });
  }
});

activityRouter.put('/:id', authMiddleware, async (request, response) => {
  try {
    const result = await callCloudFunction<{ id: string }>('activity', {
      action: 'update',
      data: request.body,
      id: String(request.params.id),
      token: resolveRequestToken(request),
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const detail = await fetchActivityDetail(String(request.params.id));
    if (!detail.success) {
      response.status(400).json({ message: detail.error });
      return;
    }

    response.json(detail.data);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '更新活动失败' });
  }
});

activityRouter.delete('/:id', authMiddleware, async (request, response) => {
  try {
    const result = await callCloudFunction<{ id: string }>('activity', {
      action: 'delete',
      id: String(request.params.id),
      token: resolveRequestToken(request),
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    response.json({ success: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '删除活动失败' });
  }
});

activityRouter.post('/:id/signup', wxCloudrunAuth, async (request, response) => {
  const nickname = String(request.body?.nickname ?? '').trim();
  const phone = String(request.body?.phone ?? '').trim();
  const wechatId = String(request.body?.wechatId ?? '').trim();

  if (!nickname || !phone || !wechatId) {
    response.status(400).json({ message: '报名信息不完整' });
    return;
  }

  try {
    const result = await callCloudFunction<{ id: string }>('activity', {
      action: 'signup',
      id: String(request.params.id),
      nickname,
      openid: request.wxUser?.openid,
      phone,
      unionid: request.wxUser?.unionid,
      wechatId,
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const detail = await fetchActivityDetail(String(request.params.id));
    if (!detail.success) {
      response.status(400).json({ message: detail.error });
      return;
    }

    response.json(detail.data);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '活动报名失败' });
  }
});
