import { randomUUID } from 'node:crypto';
import {
  deleteActivity as deletePersistedActivity,
  getActivityById as getPersistedActivityById,
  listActivities as listPersistedActivities,
  registerActivityParticipant as registerPersistedActivityParticipant,
  upsertActivity as upsertPersistedActivity,
} from '../data/activities.js';
import {
  activitySeedData,
  adminSeedData,
  commentSeedData,
  postSeedData,
  posterSeedData,
  siteConfigSeedData,
} from './seed.js';
import type {
  ActivityRecord,
  ActivitySignupRecord,
  AdminRecord,
  CommentRecord,
  PostRecord,
  PosterRecord,
  SiteConfigRecord,
} from './types.js';

interface MockDatabase {
  activities: ActivityRecord[];
  admins: AdminRecord[];
  comments: CommentRecord[];
  posts: PostRecord[];
  posters: PosterRecord[];
  siteConfig: SiteConfigRecord;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function normalizeActivityRecord(record: ActivityRecord): ActivityRecord {
  const coverImage = record.coverImage || record.cover || record.gallery?.[0] || record.covers?.[0] || '';
  const cover = record.cover || coverImage;
  const covers = Array.from(
    new Set([cover, coverImage, ...(record.covers ?? []), ...(record.gallery ?? [])].filter(Boolean)),
  );

  return {
    ...record,
    cover,
    coverImage,
    covers,
    gallery: record.gallery?.length ? record.gallery : covers,
    cardEligible: Boolean(record.cardEligible),
  };
}

function createInitialState(): MockDatabase {
  return {
    activities: clone(activitySeedData).map((item) => normalizeActivityRecord(item)),
    admins: clone(adminSeedData),
    comments: clone(commentSeedData),
    posts: clone(postSeedData),
    posters: clone(posterSeedData),
    siteConfig: clone(siteConfigSeedData),
  };
}

class MockStore {
  private state: MockDatabase = createInitialState();

  getAdminByToken(token: string) {
    return this.state.admins.find((item) => item.token === token) ?? null;
  }

  loginAdmin(username: string, password: string) {
    const admin = this.state.admins.find(
      (item) => item.username === username && item.password === password,
    );

    return admin ?? null;
  }

  listPosters() {
    return clone(this.state.posters);
  }

  getPoster(id: string) {
    return clone(this.state.posters.find((item) => item.id === id) ?? null);
  }

  createPoster(data: Omit<PosterRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    const timestamp = now();
    const record: PosterRecord = {
      ...data,
      id: createId('poster'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.state.posters = [...this.state.posters, record];
    return clone(record);
  }

  updatePoster(id: string, data: Partial<PosterRecord>) {
    const current = this.state.posters.find((item) => item.id === id);

    if (!current) {
      return null;
    }

    const next: PosterRecord = {
      ...current,
      ...data,
      id,
      createdAt: current.createdAt,
      updatedAt: now(),
    };

    this.state.posters = this.state.posters.map((item) => (item.id === id ? next : item));
    return clone(next);
  }

  deletePoster(id: string) {
    const existed = this.state.posters.some((item) => item.id === id);
    this.state.posters = this.state.posters.filter((item) => item.id !== id);
    return existed;
  }

  reorderPosters(ids: string[]) {
    const mapping = new Map(this.state.posters.map((item) => [item.id, item] as const));
    const ordered: PosterRecord[] = [];

    ids.forEach((id, index) => {
      const current = mapping.get(id);
      if (!current) {
        return;
      }

      ordered.push({
        ...current,
        sort: index,
        updatedAt: now(),
      });
      mapping.delete(id);
    });

    const remaining = Array.from(mapping.values()).sort((first, second) => first.sort - second.sort);
    this.state.posters = [...ordered, ...remaining].map((item, index) => ({
      ...item,
      sort: index,
    }));

    return clone(this.state.posters);
  }

  listActivities() {
    return listPersistedActivities();
  }

  getActivity(id: string) {
    return getPersistedActivityById(id);
  }

  createActivity(data: Omit<ActivityRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    return upsertPersistedActivity(undefined, data);
  }

  updateActivity(id: string, data: Partial<ActivityRecord>) {
    const current = getPersistedActivityById(id);
    if (!current) {
      return null;
    }

    return upsertPersistedActivity(id, data);
  }

  deleteActivity(id: string) {
    return deletePersistedActivity(id);
  }

  signupActivity(id: string, signup: Omit<ActivitySignupRecord, 'createdAt' | 'id'>) {
    return registerPersistedActivityParticipant(id, signup);
  }

  listPosts() {
    return clone(this.state.posts);
  }

  getPost(id: string) {
    return clone(this.state.posts.find((item) => item.id === id) ?? null);
  }

  getPostComments(postId: string) {
    return clone(
      this.state.comments
        .filter((item) => item.postId === postId)
        .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
    );
  }

  createPost(data: Partial<PostRecord> & Pick<PostRecord, 'content'>) {
    const timestamp = now();
    const record: PostRecord = {
      id: createId('post'),
      authorId: data.authorId || 'admin-user',
      authorNickname: data.authorNickname || '管理员',
      authorAvatar: data.authorAvatar,
      content: data.content,
      images: data.images ?? [],
      likes: data.likes ?? 0,
      comments: data.comments ?? 0,
      commentsCount: data.commentsCount ?? data.comments ?? 0,
      isLiked: data.isLiked ?? false,
      isAnonymous: data.isAnonymous ?? false,
      tags: data.tags ?? [],
      color: data.color,
      isPinned: Boolean(data.isPinned),
      pinned: Boolean(data.isPinned),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.state.posts = [record, ...this.state.posts];
    return clone(record);
  }

  deletePost(id: string) {
    const existed = this.state.posts.some((item) => item.id === id);
    this.state.posts = this.state.posts.filter((item) => item.id !== id);
    this.state.comments = this.state.comments.filter((item) => item.postId !== id);
    return existed;
  }

  pinPost(id: string, pinned: boolean) {
    const current = this.state.posts.find((item) => item.id === id);

    if (!current) {
      return null;
    }

    const next: PostRecord = {
      ...current,
      isPinned: pinned,
      pinned,
      updatedAt: now(),
    };

    this.state.posts = this.state.posts.map((item) => (item.id === id ? next : item));
    return clone(next);
  }

  likePost(id: string, delta: number) {
    const current = this.state.posts.find((item) => item.id === id);

    if (!current) {
      return null;
    }

    const nextLikes = Math.max(0, current.likes + delta);
    const next: PostRecord = {
      ...current,
      likes: nextLikes,
      updatedAt: now(),
    };

    this.state.posts = this.state.posts.map((item) => (item.id === id ? next : item));
    return clone(next);
  }

  commentPost(
    postId: string,
    payload: Pick<CommentRecord, 'authorId' | 'authorNickname' | 'authorAvatar' | 'content' | 'isAnonymous'> & {
      parentId?: string;
    },
  ) {
    const currentPost = this.state.posts.find((item) => item.id === postId);

    if (!currentPost) {
      return null;
    }

    const timestamp = now();
    const record: CommentRecord = {
      id: createId('comment'),
      postId,
      authorId: payload.authorId,
      authorNickname: payload.authorNickname,
      authorAvatar: payload.authorAvatar,
      content: payload.content,
      likes: 0,
      isLiked: false,
      isAnonymous: payload.isAnonymous,
      parentId: payload.parentId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.state.comments = [record, ...this.state.comments];
    const nextPost: PostRecord = {
      ...currentPost,
      comments: currentPost.comments + 1,
      commentsCount: (currentPost.commentsCount ?? currentPost.comments) + 1,
      updatedAt: timestamp,
    };
    this.state.posts = this.state.posts.map((item) => (item.id === postId ? nextPost : item));

    return clone(record);
  }

  getSiteConfig() {
    return clone(this.state.siteConfig);
  }

  updateSiteConfig(data: SiteConfigRecord) {
    this.state.siteConfig = clone(data);
    return clone(this.state.siteConfig);
  }
}

export const mockStore = new MockStore();
