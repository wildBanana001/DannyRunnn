import { Router } from 'express';
import { callCloudFunction, normalizePoster } from '../cloudClient.js';
import {
  isPosterPayloadValidationError,
  isPublicPoster,
  validatePosterEnabledInput,
} from '../data/poster-contract.js';
import { authMiddleware, resolveRequestToken } from '../middleware/auth.js';
import type { PosterRecord } from '../mock/types.js';

function parsePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fetchPosterDetail(id: string) {
  const detailResult = await callCloudFunction<Record<string, unknown>>('poster', {
    action: 'get',
    id,
  });

  if (!detailResult.success) {
    return detailResult;
  }

  const poster = normalizePoster(detailResult.data);
  if (!poster) {
    return { success: false as const, error: '海报不存在' };
  }

  return { success: true as const, data: poster };
}

export const posterRouter = Router();

posterRouter.put('/reorder', authMiddleware, async (request, response) => {
  const ids = Array.isArray(request.body?.ids) ? request.body.ids.map((item: unknown) => String(item)) : [];

  try {
    const result = await callCloudFunction<{ success?: boolean }>('poster', {
      action: 'reorder',
      ids,
      token: resolveRequestToken(request),
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    response.json({ success: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '海报排序失败' });
  }
});

posterRouter.get('/', async (request, response) => {
  const page = parsePage(request.query.page, 1);
  const pageSize = parsePage(request.query.pageSize, 10);

  try {
    const result = await callCloudFunction<Record<string, unknown>[]>('poster', {
      action: 'list',
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    let list = result.data
      .map((item) => normalizePoster(item))
      .filter((item): item is PosterRecord => isPublicPoster(item));

    list = list.sort((first, second) => {
      if (first.sort !== second.sort) {
        return first.sort - second.sort;
      }
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });

    const startIndex = (page - 1) * pageSize;
    response.json({
      list: list.slice(startIndex, startIndex + pageSize),
      total: list.length,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取海报列表失败' });
  }
});

posterRouter.post('/', authMiddleware, async (request, response) => {
  try {
    validatePosterEnabledInput((request.body as Record<string, unknown>) ?? {}, true);
    const result = await callCloudFunction<{ id: string }>('poster', {
      action: 'create',
      data: request.body,
      token: resolveRequestToken(request),
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const detail = await fetchPosterDetail(result.data.id);
    if (!detail.success) {
      response.status(400).json({ message: detail.error });
      return;
    }

    response.json(detail.data);
  } catch (error) {
    response.status(isPosterPayloadValidationError(error) ? 422 : 500).json({
      message: error instanceof Error ? error.message : '创建海报失败',
    });
  }
});

posterRouter.get('/:id', async (request, response) => {
  try {
    const result = await fetchPosterDetail(String(request.params.id));

    if (!result.success) {
      response.status(404).json({ message: result.error });
      return;
    }

    if (!isPublicPoster(result.data)) {
      response.status(404).json({ message: '海报不存在或已下线' });
      return;
    }
    response.json(result.data);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取海报详情失败' });
  }
});

posterRouter.put('/:id', authMiddleware, async (request, response) => {
  try {
    validatePosterEnabledInput((request.body as Record<string, unknown>) ?? {}, false);
    const result = await callCloudFunction<{ id: string }>('poster', {
      action: 'update',
      data: request.body,
      id: String(request.params.id),
      token: resolveRequestToken(request),
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const detail = await fetchPosterDetail(String(request.params.id));
    if (!detail.success) {
      response.status(400).json({ message: detail.error });
      return;
    }

    response.json(detail.data);
  } catch (error) {
    response.status(isPosterPayloadValidationError(error) ? 422 : 500).json({
      message: error instanceof Error ? error.message : '更新海报失败',
    });
  }
});

posterRouter.delete('/:id', authMiddleware, async (request, response) => {
  try {
    const result = await callCloudFunction<{ id: string }>('poster', {
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
    response.status(500).json({ message: error instanceof Error ? error.message : '删除海报失败' });
  }
});
