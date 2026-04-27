import { currentUser } from '@/data/users';
import { featuredActivity, ongoingActivities } from '@/data/activities';
import { comments as mockComments, posts as mockPosts } from '@/data/posts';
import { posters as mockPosters } from '@/data/posters';
import { siteConfig as mockSiteConfig } from '@/data/site';
import { request as apiRequest, getApiMode } from '@/services/request';
import type { Activity } from '@/types';
import type { Comment, Post, PostCreateParams } from '@/types/post';
import type { CloudResponse, Poster, SiteConfig } from '@/types/site';
import { buildPostTitle } from '@/utils/helpers';
import { callFn } from './index';

interface RegistrationPayload {
  activityId: string;
  nickname: string;
  phone: string;
  wechatId: string;
}

interface PostDetailResult {
  post: Post;
  comments: Comment[];
}

interface RemoteListResponse<T> {
  list: T[];
  total: number;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

let localPosts: Post[] = clone(mockPosts);
let localComments: Comment[] = clone(mockComments);

const normalizeActivity = (activity: Activity): Activity => ({
  ...activity,
  cover: activity.cover || activity.coverImage,
  covers: activity.covers && activity.covers.length > 0 ? activity.covers : [activity.cover || activity.coverImage, ...(activity.gallery || [])],
  cardEligible: activity.cardEligible ?? false
});

const normalizePost = (post: Partial<Post> & Pick<Post, 'content' | 'authorId' | 'authorNickname' | 'createdAt' | 'updatedAt'>): Post => ({
  id: post.id || post._id || `post-${Date.now()}`,
  _id: post._id || post.id || `post-${Date.now()}`,
  authorId: post.authorId,
  authorNickname: post.authorNickname,
  authorAvatar: post.authorAvatar,
  title: buildPostTitle(post.title, post.content),
  content: post.content,
  images: Array.isArray(post.images) ? post.images : [],
  likes: post.likes ?? 0,
  comments: post.commentsCount ?? post.comments ?? 0,
  commentsCount: post.commentsCount ?? post.comments ?? 0,
  isLiked: Boolean(post.isLiked),
  isAnonymous: Boolean(post.isAnonymous),
  tags: Array.isArray(post.tags) ? post.tags.map((item) => String(item)) : [],
  color: post.color || 'yellow',
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
  pinned: Boolean(post.pinned)
});

const sortByCreatedDesc = <T extends { createdAt: string }>(list: T[]): T[] => {
  return [...list].sort((prev, next) => new Date(next.createdAt).getTime() - new Date(prev.createdAt).getTime());
};

const isMockMode = () => getApiMode() === 'mock';

const safeCall = async <T>(
  name: string,
  data: Record<string, unknown>,
  fallback: () => T | Promise<T>,
  remote?: () => Promise<T>
): Promise<T> => {
  try {
    if (isMockMode()) {
      const response = await callFn<CloudResponse<T>>(name, data);
      if (response?.success) {
        return response.data as T;
      }
      throw new Error((response as any)?.error || '云函数调用失败');
    }

    if (!remote) {
      throw new Error('当前请求未配置远端实现');
    }

    return remote();
  } catch (error) {
    console.warn(`[cloud] ${name} 调用失败，使用本地 fallback`, error);
  }

  return fallback();
};

export async function fetchPosterList(): Promise<Poster[]> {
  const data = await safeCall(
    'poster',
    { action: 'list', enabled: true },
    async () => mockPosters.filter((item) => item.enabled).sort((prev, next) => prev.sort - next.sort),
    async () => {
      const response = await apiRequest<RemoteListResponse<Poster>>({ path: '/api/posters?enabled=true' });
      return response.list;
    }
  );
  return [...data].sort((prev, next) => prev.sort - next.sort);
}

export async function fetchPosterDetail(id: string): Promise<Poster | null> {
  return safeCall(
    'poster',
    { action: 'get', id },
    async () => mockPosters.find((item) => item.id === id) ?? null,
    async () => apiRequest<Poster | null>({ path: `/api/posters/${encodeURIComponent(id)}` })
  );
}

export async function fetchSiteConfig(): Promise<SiteConfig> {
  return safeCall(
    'site_config',
    { action: 'get' },
    async () => mockSiteConfig,
    async () => apiRequest<SiteConfig>({ path: '/api/site/config' })
  );
}

export async function fetchActivities(status: 'ongoing' | 'ended'): Promise<Activity[]> {
  const data = await safeCall(
    'activity',
    { action: 'list', status },
    async () => (status === 'ongoing' ? ongoingActivities : []),
    async () => {
      const response = await apiRequest<RemoteListResponse<Activity>>({
        path: `/api/activities?status=${encodeURIComponent(status)}`,
      });
      return response.list;
    }
  );
  return data.map((item) => normalizeActivity(item));
}

export async function fetchActivity(
  id: string,
  options: { fallbackToMock?: boolean } = {}
): Promise<Activity | null> {
  const { fallbackToMock = true } = options;

  if (isMockMode()) {
    return normalizeActivity(ongoingActivities.find((activity) => activity.id === id) ?? featuredActivity);
  }

  if (!fallbackToMock) {
    try {
      const activity = await apiRequest<Activity>({ path: `/api/activities/${encodeURIComponent(id)}` });
      return normalizeActivity(activity);
    } catch (error) {
      console.warn('[activity] load failed', id, error);
      return null;
    }
  }

  const activity = await safeCall(
    'activity',
    { action: 'get', id },
    async () => ongoingActivities.find((activity) => activity.id === id) ?? featuredActivity,
    async () => apiRequest<Activity>({ path: `/api/activities/${encodeURIComponent(id)}` })
  );
  return normalizeActivity(activity);
}

export async function fetchActivityDetail(id: string): Promise<Activity> {
  const activity = await fetchActivity(id);
  return activity ?? normalizeActivity(featuredActivity);
}

export async function submitActivitySignup(payload: RegistrationPayload): Promise<{ success: boolean }> {
  return safeCall(
    'activity',
    { action: 'signup', ...payload },
    async () => ({ success: true }),
    async () => {
      await apiRequest<Activity>({
        data: {
          nickname: payload.nickname,
          phone: payload.phone,
          wechatId: payload.wechatId,
        },
        method: 'POST',
        path: `/api/activities/${encodeURIComponent(payload.activityId)}/signup`,
      });
      return { success: true };
    }
  );
}

export async function fetchPostList(): Promise<Post[]> {
  const data = await safeCall(
    'post',
    { action: 'list' },
    async () => sortByCreatedDesc(localPosts).map((item) => normalizePost(item)),
    async () => {
      const response = await apiRequest<RemoteListResponse<Post>>({ path: '/api/posts' });
      return response.list;
    }
  );
  return sortByCreatedDesc(data.map((item) => normalizePost(item)));
}

export async function fetchPostDetail(id: string): Promise<PostDetailResult> {
  return safeCall(
    'post',
    { action: 'get', id },
    async () => {
      const post = localPosts.find((item) => item.id === id) ?? normalizePost(localPosts[0]);
      const commentList = sortByCreatedDesc(localComments.filter((item) => item.postId === id));
      return {
        post: normalizePost(post),
        comments: commentList
      };
    },
    async () => apiRequest<PostDetailResult>({ path: `/api/posts/${encodeURIComponent(id)}` })
  );
}

export async function createWallPost(payload: PostCreateParams): Promise<Post> {
  return safeCall(
    'post',
    {
      action: 'create',
      ...payload,
      authorId: currentUser.id,
      authorNickname: currentUser.nickname,
      authorAvatar: currentUser.avatar
    },
    async () => {
      const now = new Date().toISOString();
      const nextId = `post-${Date.now()}`;
      const newPost: Post = normalizePost({
        id: nextId,
        _id: nextId,
        authorId: currentUser.id,
        authorNickname: payload.isAnonymous ? '匿名用户' : currentUser.nickname,
        authorAvatar: payload.isAnonymous ? undefined : currentUser.avatar,
        title: payload.title,
        content: payload.content,
        images: payload.images,
        likes: 0,
        comments: 0,
        commentsCount: 0,
        isLiked: false,
        isAnonymous: payload.isAnonymous,
        tags: payload.tags,
        color: payload.color,
        createdAt: now,
        updatedAt: now
      });
      localPosts = [newPost, ...localPosts];
      return newPost;
    },
    async () => apiRequest<Post>({
      data: {
        ...payload,
        authorAvatar: currentUser.avatar,
        authorId: currentUser.id,
        authorNickname: currentUser.nickname
      },
      method: 'POST',
      path: '/api/posts',
    })
  );
}

export async function likeWallPost(id: string, nextLiked: boolean): Promise<Post | null> {
  return safeCall(
    'post',
    { action: 'like', id },
    async () => {
      let updatedPost: Post | null = null;
      localPosts = localPosts.map((item) => {
        if (item.id !== id) {
          return item;
        }
        updatedPost = normalizePost({
          ...item,
          isLiked: nextLiked,
          likes: Math.max(0, item.likes + (nextLiked ? 1 : -1)),
          updatedAt: new Date().toISOString()
        });
        return updatedPost;
      });
      return updatedPost;
    },
    async () => apiRequest<Post | null>({
      data: { delta: nextLiked ? 1 : -1 },
      method: 'POST',
      path: `/api/posts/${encodeURIComponent(id)}/like`,
    })
  );
}

export async function commentWallPost(postId: string, content: string): Promise<Comment> {
  return safeCall(
    'post',
    {
      action: 'comment',
      id: postId,
      content,
      authorId: currentUser.id,
      authorNickname: currentUser.nickname,
      authorAvatar: currentUser.avatar
    },
    async () => {
      const now = new Date().toISOString();
      const comment: Comment = {
        id: `comment-${Date.now()}`,
        _id: `comment-${Date.now()}`,
        postId,
        authorId: currentUser.id,
        authorNickname: currentUser.nickname,
        authorAvatar: currentUser.avatar,
        content,
        likes: 0,
        isLiked: false,
        isAnonymous: false,
        createdAt: now,
        updatedAt: now
      };
      localComments = [comment, ...localComments];
      localPosts = localPosts.map((item) =>
        item.id === postId
          ? normalizePost({
              ...item,
              comments: item.comments + 1,
              commentsCount: (item.commentsCount ?? item.comments) + 1,
              updatedAt: now
            })
          : item
      );
      return comment;
    },
    async () => apiRequest<Comment>({
      data: {
        authorAvatar: currentUser.avatar,
        authorId: currentUser.id,
        authorNickname: currentUser.nickname,
        content,
      },
      method: 'POST',
      path: `/api/posts/${encodeURIComponent(postId)}/comments`,
    })
  );
}
