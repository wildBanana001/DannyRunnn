import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import type { CommentRecord, PostRecord } from '../mock/types.js';
import { getUserByOpenid } from '../data/users.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import {
  commentCommunityPost,
  createCommunityPost,
  deleteCommunityPost,
  getCommunityPostDetail,
  likeCommunityPost,
  listCommunityPosts,
  pinCommunityPost,
} from '../services/community.js';
import { resolveWxOpenid } from './utils.js';

function parsePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function toClientPost(post: PostRecord): PostRecord {
  return {
    ...post,
    authorId: '',
    authorAvatar: post.isAnonymous ? undefined : post.authorAvatar,
    authorNickname: post.isAnonymous ? '匿名用户' : post.authorNickname,
  };
}

function toClientComment(comment: CommentRecord): CommentRecord {
  return {
    ...comment,
    authorId: '',
    authorAvatar: comment.isAnonymous ? undefined : comment.authorAvatar,
    authorNickname: comment.isAnonymous ? '匿名用户' : comment.authorNickname,
  };
}

export const postRouter = Router();

postRouter.get('/', async (request, response) => {
  const page = parsePage(request.query.page, 1);
  const pageSize = Math.min(parsePage(request.query.pageSize, 10), 100);
  const keyword = typeof request.query.keyword === 'string' ? request.query.keyword.trim().toLowerCase() : '';
  const onlyPinned = request.query.onlyPinned === 'true';
  const colors = typeof request.query.colors === 'string'
    ? request.query.colors.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  try {
    let list = await listCommunityPosts();
    if (keyword) {
      list = list.filter((item) => [item.title, item.content, ...item.tags].join(' ').toLowerCase().includes(keyword));
    }
    if (onlyPinned) list = list.filter((item) => item.isPinned);
    if (colors.length) list = list.filter((item) => item.color && colors.includes(item.color));
    list = list.sort((first, second) => {
      if (first.isPinned !== second.isPinned) return Number(second.isPinned) - Number(first.isPinned);
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });

    const startIndex = (page - 1) * pageSize;
    response.json({
      list: list.slice(startIndex, startIndex + pageSize).map(toClientPost),
      total: list.length,
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取帖子列表失败' });
  }
});

postRouter.post('/', wxCloudrunAuth, async (request, response) => {
  const openid = resolveWxOpenid(request);
  const user = getUserByOpenid(openid);
  const isAnonymous = Boolean(request.body?.isAnonymous);
  try {
    const post = await createCommunityPost({
      authorAvatar: isAnonymous ? undefined : user?.avatar,
      authorId: openid,
      authorNickname: isAnonymous ? '匿名用户' : (user?.nickname || '微信用户'),
      color: request.body?.color,
      content: request.body?.content,
      imageFileIds: request.body?.imageFileIds,
      images: request.body?.images,
      isAnonymous,
      tags: request.body?.tags,
      title: request.body?.title,
    });
    response.json(post ? toClientPost(post) : null);
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建帖子失败';
    response.status(message === '留言内容不能为空' ? 400 : 500).json({ message });
  }
});

postRouter.get('/mine', wxCloudrunAuth, async (request, response) => {
  const openid = resolveWxOpenid(request);
  try {
    const data = (await listCommunityPosts())
      .filter((item) => item.authorId === openid)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
      .map(toClientPost);
    response.json({ data, list: data, total: data.length });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取我的帖子失败' });
  }
});

postRouter.get('/:id', async (request, response) => {
  try {
    const detail = await getCommunityPostDetail(String(request.params.id));
    if (!detail) {
      response.status(404).json({ message: '帖子不存在' });
      return;
    }
    response.json({
      comments: detail.comments.map(toClientComment),
      post: toClientPost(detail.post),
    });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '获取帖子详情失败' });
  }
});

postRouter.delete('/:id', authMiddleware, async (request, response) => {
  try {
    const deleted = await deleteCommunityPost(String(request.params.id));
    if (!deleted) {
      response.status(404).json({ message: '帖子不存在' });
      return;
    }
    response.json({ success: true });
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '删除帖子失败' });
  }
});

postRouter.patch('/:id/pin', authMiddleware, async (request, response) => {
  try {
    const post = await pinCommunityPost(String(request.params.id), Boolean(request.body?.isPinned));
    if (!post) {
      response.status(404).json({ message: '帖子不存在' });
      return;
    }
    response.json(toClientPost(post));
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '更新置顶状态失败' });
  }
});

postRouter.post('/:id/comments', wxCloudrunAuth, async (request, response) => {
  const openid = resolveWxOpenid(request);
  const user = getUserByOpenid(openid);
  const isAnonymous = Boolean(request.body?.isAnonymous);
  try {
    const comment = await commentCommunityPost(String(request.params.id), {
      authorAvatar: isAnonymous ? undefined : user?.avatar,
      authorId: openid,
      authorNickname: isAnonymous ? '匿名用户' : (user?.nickname || '微信用户'),
      content: request.body?.content,
      isAnonymous,
      parentId: request.body?.parentId,
    });
    if (!comment) {
      response.status(404).json({ message: '帖子不存在' });
      return;
    }
    response.json(toClientComment(comment));
  } catch (error) {
    const message = error instanceof Error ? error.message : '新增评论失败';
    response.status(message === '评论内容不能为空' ? 400 : 500).json({ message });
  }
});

postRouter.post('/:id/like', wxCloudrunAuth, async (request, response) => {
  try {
    const post = await likeCommunityPost(String(request.params.id), Number(request.body?.delta ?? 1));
    if (!post) {
      response.status(404).json({ message: '帖子不存在' });
      return;
    }
    response.json(toClientPost(post));
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '点赞失败' });
  }
});
