import { currentUser } from '@/data/users';
import { ongoingActivities } from '@/data/activities';
import { dinnerTableCoverImage } from '@/data/activity-assets';
import { comments as mockComments, posts as mockPosts } from '@/data/posts';
import { posters as mockPosters } from '@/data/posters';
import { siteConfig as mockSiteConfig } from '@/data/site';
import { request as apiRequest, getApiMode } from '@/services/request';
import { resolvePostImageUrls, resolvePostListImageUrls } from '@/services/postImages';
import { useUserStore } from '@/store/userStore';
import type { Activity } from '@/types';
import type { Comment, Post, PostCreateParams } from '@/types/post';
import type { Poster, SiteConfig } from '@/types/site';
import { buildPostTitle } from '@/utils/helpers';

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

const localActivityCoverImages: Partial<Record<string, string>> = {
  'act-002': dinnerTableCoverImage,
};

const normalizeActivity = (activity: Activity): Activity => {
  const localCoverImage = localActivityCoverImages[activity.id];
  const coverImage = localCoverImage || activity.cover || activity.coverImage;
  const gallery = (activity.gallery || []).filter((item) => !item.startsWith('activity-asset://'));

  return {
    ...activity,
    coverImage,
    gallery,
    cover: coverImage,
    covers: localCoverImage
      ? [coverImage, ...gallery]
      : activity.covers && activity.covers.length > 0
        ? activity.covers
        : [coverImage, ...gallery],
    cardEligible: activity.cardEligible ?? false,
  };
};

const normalizePost = (post: Partial<Post> & Pick<Post, 'content' | 'authorId' | 'authorNickname' | 'createdAt' | 'updatedAt'>): Post => ({
  id: post.id || post._id || `post-${Date.now()}`,
  _id: post._id || post.id || `post-${Date.now()}`,
  authorId: post.authorId,
  authorNickname: post.authorNickname,
  authorAvatar: post.authorAvatar,
  title: buildPostTitle(post.title, post.content),
  content: post.content,
  images: Array.isArray(post.images) ? post.images : [],
  imageFileIds: Array.isArray(post.imageFileIds) ? post.imageFileIds : [],
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

const getCurrentPostAuthor = () => {
  const user = useUserStore.getState().user;
  return user
    ? { id: user.openid || user.id, nickname: user.nickname || '微信用户', avatar: user.avatar }
    : currentUser;
};

export function resetLocalPostData() {
  localPosts = clone(mockPosts);
  localComments = clone(mockComments);
}

const safeCall = async <T>(
  name: string,
  _data: Record<string, unknown>,
  fallback: () => T | Promise<T>,
  remote?: () => Promise<T>
): Promise<T> => {
  const mockMode = isMockMode();
  if (mockMode) {
    return fallback();
  }

  if (!remote) {
    throw new Error(`请求 ${name} 未配置远端实现`);
  }

  return remote();
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
    const matchedActivity = ongoingActivities.find((activity) => activity.id === id);
    return matchedActivity ? normalizeActivity(matchedActivity) : null;
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
    async () => ongoingActivities.find((activity) => activity.id === id) ?? null,
    async () => apiRequest<Activity>({ path: `/api/activities/${encodeURIComponent(id)}` })
  );
  return activity ? normalizeActivity(activity) : null;
}

export async function fetchActivityDetail(id: string): Promise<Activity> {
  const activity = await fetchActivity(id);
  if (!activity || activity.id !== id) {
    throw new Error('活动不存在或已下架');
  }
  return activity;
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
  const normalizedPosts = sortByCreatedDesc(data.map((item) => normalizePost(item)));
  return resolvePostListImageUrls(normalizedPosts);
}

export async function fetchPostDetail(id: string): Promise<PostDetailResult> {
  const detail = await safeCall(
    'post',
    { action: 'get', id },
    async () => {
      const post = localPosts.find((item) => item.id === id);
      if (!post) {
        throw new Error('帖子不存在或已删除');
      }
      const commentList = sortByCreatedDesc(localComments.filter((item) => item.postId === id));
      return {
        post: normalizePost(post),
        comments: commentList
      };
    },
    async () => apiRequest<PostDetailResult>({ path: `/api/posts/${encodeURIComponent(id)}` })
  );
  return {
    ...detail,
    post: await resolvePostImageUrls(normalizePost(detail.post)),
  };
}

export async function createWallPost(payload: PostCreateParams): Promise<Post> {
  const author = getCurrentPostAuthor();
  const post = await safeCall(
    'post',
    {
      action: 'create',
      ...payload,
      authorId: author.id,
      authorNickname: author.nickname,
      authorAvatar: author.avatar
    },
    async () => {
      const now = new Date().toISOString();
      const nextId = `post-${Date.now()}`;
      const newPost: Post = normalizePost({
        id: nextId,
        _id: nextId,
        authorId: author.id,
        authorNickname: payload.isAnonymous ? '匿名用户' : author.nickname,
        authorAvatar: payload.isAnonymous ? undefined : author.avatar,
        title: payload.title,
        content: payload.content,
        images: payload.images,
        imageFileIds: payload.imageFileIds,
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
      data: payload,
      method: 'POST',
      path: '/api/posts',
    })
  );
  return resolvePostImageUrls(normalizePost(post));
}

export async function likeWallPost(id: string, nextLiked: boolean): Promise<Post | null> {
  const post = await safeCall(
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
  return post ? resolvePostImageUrls(normalizePost(post)) : null;
}

export async function commentWallPost(postId: string, content: string): Promise<Comment> {
  const author = getCurrentPostAuthor();
  return safeCall(
    'post',
    {
      action: 'comment',
      id: postId,
      content,
      authorId: author.id,
      authorNickname: author.nickname,
      authorAvatar: author.avatar
    },
    async () => {
      const now = new Date().toISOString();
      const comment: Comment = {
        id: `comment-${Date.now()}`,
        _id: `comment-${Date.now()}`,
        postId,
        authorId: author.id,
        authorNickname: author.nickname,
        authorAvatar: author.avatar,
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
      data: { content },
      method: 'POST',
      path: `/api/posts/${encodeURIComponent(postId)}/comments`,
    })
  );
}
