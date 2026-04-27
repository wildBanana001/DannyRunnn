import { Router } from 'express';
import {
  callCloudFunction,
  normalizeComment,
  normalizePost,
} from '../cloudClient.js';
import { authMiddleware, resolveRequestToken } from '../middleware/auth.js';
import type { CommentRecord, PostRecord } from '../mock/types.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import { resolveWxOpenid } from './utils.js';

function parsePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fetchPostDetail(id: string) {
  const result = await callCloudFunction<{
    comments?: Record<string, unknown>[];
    post?: Record<string, unknown>;
  }>('post', {
    action: 'get',
    id,
  });

  if (!result.success) {
    return result;
  }

  const post = normalizePost(result.data.post ?? null);
  if (!post) {
    return { success: false as const, error: '帖子不存在' };
  }

  const comments = Array.isArray(result.data.comments)
    ? result.data.comments
        .map((item) => normalizeComment(item))
        .filter((item): item is CommentRecord => Boolean(item))
    : [];

  return { success: true as const, data: { comments, post } };
}

export const postRouter = Router();

postRouter.get('/', async (request, response) => {
  const page = parsePage(request.query.page, 1);
  const pageSize = parsePage(request.query.pageSize, 10);
  const keyword = typeof request.query.keyword === 'string' ? request.query.keyword.trim().toLowerCase() : '';
  const onlyPinned = request.query.onlyPinned === 'true';
  const colors = typeof request.query.colors === 'string'
    ? request.query.colors
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  try {
    const result = await callCloudFunction<Record<string, unknown>[]>('post', {
      action: 'list',
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    let list = result.data
      .map((item) => normalizePost(item))
      .filter((item): item is PostRecord => Boolean(item));

    if (keyword) {
      list = list.filter((item) => {
        const searchSource = [item.title, item.content, ...item.tags].join(' ').toLowerCase();
        return searchSource.includes(keyword);
      });
    }

    if (onlyPinned) {
      list = list.filter((item) => item.isPinned);
    }

    if (colors.length) {
      list = list.filter((item) => item.color && colors.includes(item.color));
    }

    list = list.sort((first, second) => {
      if (first.isPinned !== second.isPinned) {
        return Number(second.isPinned) - Number(first.isPinned);
      }
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });

    const startIndex = (page - 1) * pageSize;
    response.json({
      list: list.slice(startIndex, startIndex + pageSize),
      total: list.length,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取帖子列表失败' });
  }
});

postRouter.post('/', wxCloudrunAuth, async (request, response) => {
  try {
    const result = await callCloudFunction<{ id: string }>('post', {
      action: 'create',
      data: {
        ...request.body,
        authorId: request.body?.authorId ?? request.wxUser?.openid,
      },
      openid: request.wxUser?.openid,
      unionid: request.wxUser?.unionid,
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const detail = await fetchPostDetail(result.data.id);
    if (!detail.success) {
      response.status(400).json({ message: detail.error });
      return;
    }

    response.json(detail.data.post);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '创建帖子失败' });
  }
});

postRouter.get('/mine', async (request, response) => {
  const openid = resolveWxOpenid(request);
  if (!openid) {
    response.json({ data: [], list: [], total: 0 });
    return;
  }

  try {
    const result = await callCloudFunction<Record<string, unknown>[]>('post', {
      action: 'list',
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const data = result.data
      .map((item) => normalizePost(item))
      .filter((item): item is PostRecord => item !== null && item.authorId === openid)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());

    response.json({ data, list: data, total: data.length });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取我的帖子失败' });
  }
});

postRouter.get('/:id', async (request, response) => {
  try {
    const result = await fetchPostDetail(String(request.params.id));

    if (!result.success) {
      response.status(404).json({ message: result.error });
      return;
    }

    response.json(result.data);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取帖子详情失败' });
  }
});

postRouter.delete('/:id', authMiddleware, async (request, response) => {
  try {
    const result = await callCloudFunction<{ id: string }>('post', {
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
    response.status(500).json({ message: error instanceof Error ? error.message : '删除帖子失败' });
  }
});

postRouter.patch('/:id/pin', authMiddleware, async (request, response) => {
  try {
    const result = await callCloudFunction<{ id: string }>('post', {
      action: 'pin',
      id: String(request.params.id),
      isPinned: Boolean(request.body?.isPinned),
      pinned: Boolean(request.body?.isPinned),
      token: resolveRequestToken(request),
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const detail = await fetchPostDetail(String(request.params.id));
    if (!detail.success) {
      response.status(400).json({ message: detail.error });
      return;
    }

    response.json(detail.data.post);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '更新置顶状态失败' });
  }
});

postRouter.post('/:id/comments', wxCloudrunAuth, async (request, response) => {
  const content = String(request.body?.content ?? '').trim();

  if (!content) {
    response.status(400).json({ message: '评论内容不能为空' });
    return;
  }

  try {
    const result = await callCloudFunction<Record<string, unknown>>('post', {
      action: 'comment',
      authorAvatar: request.body?.authorAvatar,
      authorId: request.body?.authorId ?? request.wxUser?.openid ?? 'wx-user',
      authorNickname: request.body?.authorNickname ?? '微信用户',
      content,
      id: String(request.params.id),
      isAnonymous: Boolean(request.body?.isAnonymous),
      openid: request.wxUser?.openid,
      parentId: request.body?.parentId,
      unionid: request.wxUser?.unionid,
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const comment = normalizeComment(result.data);
    response.json(comment);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '新增评论失败' });
  }
});

postRouter.post('/:id/like', wxCloudrunAuth, async (request, response) => {
  try {
    const result = await callCloudFunction<Record<string, unknown>>('post', {
      action: 'like',
      delta: Number(request.body?.delta ?? 1),
      id: String(request.params.id),
      openid: request.wxUser?.openid,
      unionid: request.wxUser?.unionid,
    });

    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    const post = normalizePost(result.data);
    response.json(post);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '点赞失败' });
  }
});
