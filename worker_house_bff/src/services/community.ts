import { config, hasWechatCloudConfig } from '../config.js';
import { normalizeComment, normalizePost } from '../cloudClient.js';
import { mockStore } from '../mock/store.js';
import type { CommentRecord, PostRecord } from '../mock/types.js';
import {
  addCloudDocument,
  deleteCloudDocument,
  deleteCloudDocumentsWhere,
  getCloudDocument,
  incrementCloudDocumentFields,
  queryCloudDocuments,
  updateCloudDocument,
} from '../wechatCloudData.js';
import { deleteWechatCloudFiles } from '../wechatStorage.js';

const POST_COLLECTION = 'posts';
const COMMENT_COLLECTION = 'comments';
const allowedColors = new Set<PostRecord['color']>(['yellow', 'pink', 'blue', 'green', 'orange', 'purple']);

export interface CreateCommunityPostInput {
  authorAvatar?: string;
  authorId: string;
  authorNickname: string;
  color?: PostRecord['color'];
  content: string;
  imageFileIds?: string[];
  images?: string[];
  isAnonymous?: boolean;
  tags?: string[];
  title?: string;
}

export interface CreateCommunityCommentInput {
  authorAvatar?: string;
  authorId: string;
  authorNickname: string;
  content: string;
  isAnonymous?: boolean;
  parentId?: string;
}

export interface CommunityDeletionResult {
  commentsDeleted: number;
  failedFileIds: string[];
  filesDeleted: number;
  postsDeleted: number;
}

function useMockStore() {
  return config.cloudMode === 'mock'
    || (config.cloudMode === 'cloudrun' && config.allowEphemeralCloudrunData && !hasWechatCloudConfig());
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

function normalizePostList(records: Record<string, unknown>[]) {
  return records
    .map((record) => normalizePost(record))
    .filter((record): record is PostRecord => Boolean(record));
}

function normalizeCommentList(records: Record<string, unknown>[]) {
  return records
    .map((record) => normalizeComment(record))
    .filter((record): record is CommentRecord => Boolean(record));
}

function recordIdentity(record: Record<string, unknown>) {
  return cleanString(record._id ?? record.id);
}

function uniqueRecords(records: Record<string, unknown>[]) {
  const mapping = new Map<string, Record<string, unknown>>();
  records.forEach((record) => {
    const identity = recordIdentity(record);
    if (identity) mapping.set(identity, record);
  });
  return Array.from(mapping.values());
}

async function listRecordsOwnedBy(collectionName: string, openid: string) {
  const [currentRecords, legacyRecords] = await Promise.all([
    queryCloudDocuments<Record<string, unknown>>(collectionName, { where: { authorId: openid } }),
    queryCloudDocuments<Record<string, unknown>>(collectionName, { where: { _openid: openid } }),
  ]);
  return uniqueRecords([...currentRecords, ...legacyRecords]);
}

async function refreshCommentCount(postId: string) {
  const post = await getCloudDocument<Record<string, unknown>>(POST_COLLECTION, postId);
  if (!post) return;
  const comments = await queryCloudDocuments<Record<string, unknown>>(COMMENT_COLLECTION, { where: { postId } });
  await updateCloudDocument(POST_COLLECTION, postId, {
    comments: comments.length,
    commentsCount: comments.length,
    updatedAt: new Date().toISOString(),
  });
}

async function deleteAllDocumentsWhere(collectionName: string, where: Record<string, unknown>) {
  let deleted = 0;
  const maxDeleteBatches = 1_000;
  for (let batch = 0; batch < maxDeleteBatches; batch += 1) {
    const current = await deleteCloudDocumentsWhere(collectionName, where);
    deleted += current;
    if (current === 0) return deleted;
  }
  throw new Error(`批量清理 ${collectionName} 超过安全上限，请稍后重试`);
}

export async function listCommunityPosts() {
  if (useMockStore()) return mockStore.listPosts();
  const records = await queryCloudDocuments<Record<string, unknown>>(POST_COLLECTION, {
    orderBy: { direction: 'desc', field: 'createdAt' },
  });
  return normalizePostList(records);
}

export async function getCommunityPost(id: string) {
  if (useMockStore()) return mockStore.getPost(id);
  return normalizePost(await getCloudDocument<Record<string, unknown>>(POST_COLLECTION, id));
}

export async function getCommunityPostComments(postId: string) {
  if (useMockStore()) return mockStore.getPostComments(postId);
  const records = await queryCloudDocuments<Record<string, unknown>>(COMMENT_COLLECTION, {
    orderBy: { direction: 'desc', field: 'createdAt' },
    where: { postId },
  });
  return normalizeCommentList(records);
}

export async function getCommunityPostDetail(id: string) {
  const post = await getCommunityPost(id);
  if (!post) return null;
  return { comments: await getCommunityPostComments(id), post };
}

export async function createCommunityPost(input: CreateCommunityPostInput) {
  const content = cleanString(input.content);
  const authorId = cleanString(input.authorId);
  if (!content) throw new Error('留言内容不能为空');
  if (!authorId) throw new Error('缺少用户身份');

  const isAnonymous = Boolean(input.isAnonymous);
  const timestamp = new Date().toISOString();
  const color = allowedColors.has(input.color) ? input.color : undefined;
  const payload: Omit<PostRecord, 'id'> = {
    authorAvatar: isAnonymous ? undefined : cleanString(input.authorAvatar) || undefined,
    authorId,
    authorNickname: isAnonymous ? '匿名用户' : (cleanString(input.authorNickname) || '微信用户'),
    color,
    comments: 0,
    commentsCount: 0,
    content,
    createdAt: timestamp,
    imageFileIds: cleanStringArray(input.imageFileIds),
    images: cleanStringArray(input.images),
    isAnonymous,
    isLiked: false,
    isPinned: false,
    likes: 0,
    pinned: false,
    tags: cleanStringArray(input.tags),
    title: cleanString(input.title) || undefined,
    updatedAt: timestamp,
  };

  if (useMockStore()) return mockStore.createPost(payload);
  const id = await addCloudDocument(POST_COLLECTION, payload as unknown as Record<string, unknown>);
  return normalizePost({ ...payload, _id: id, id });
}

export async function deleteCommunityPost(id: string) {
  if (useMockStore()) return mockStore.deletePost(id);
  const post = await getCloudDocument<Record<string, unknown>>(POST_COLLECTION, id);
  if (!post) return false;

  const fileCleanup = await deleteWechatCloudFiles(cleanStringArray(post.imageFileIds));
  if (fileCleanup.failures.length > 0) {
    throw new Error(`仍有 ${fileCleanup.failures.length} 张帖子图片删除失败，请稍后重试`);
  }
  await deleteAllDocumentsWhere(COMMENT_COLLECTION, { postId: id });
  await deleteCloudDocument(POST_COLLECTION, id);
  return true;
}

export async function pinCommunityPost(id: string, pinned: boolean) {
  if (useMockStore()) return mockStore.pinPost(id, pinned);
  const current = await getCloudDocument<Record<string, unknown>>(POST_COLLECTION, id);
  if (!current) return null;
  await updateCloudDocument(POST_COLLECTION, id, {
    isPinned: pinned,
    pinned,
    updatedAt: new Date().toISOString(),
  });
  return getCommunityPost(id);
}

export async function likeCommunityPost(id: string, delta: number) {
  if (useMockStore()) return mockStore.likePost(id, delta < 0 ? -1 : 1);
  const current = await getCommunityPost(id);
  if (!current) return null;
  const normalizedDelta = delta < 0 ? (current.likes > 0 ? -1 : 0) : 1;
  if (normalizedDelta !== 0) {
    await incrementCloudDocumentFields(
      POST_COLLECTION,
      id,
      { likes: normalizedDelta },
      { updatedAt: new Date().toISOString() },
    );
  }
  return getCommunityPost(id);
}

export async function commentCommunityPost(postId: string, input: CreateCommunityCommentInput) {
  const content = cleanString(input.content);
  const authorId = cleanString(input.authorId);
  if (!content) throw new Error('评论内容不能为空');
  if (!authorId) throw new Error('缺少用户身份');

  if (useMockStore()) {
    return mockStore.commentPost(postId, {
      authorAvatar: input.isAnonymous ? undefined : cleanString(input.authorAvatar) || undefined,
      authorId,
      authorNickname: input.isAnonymous ? '匿名用户' : (cleanString(input.authorNickname) || '微信用户'),
      content,
      isAnonymous: Boolean(input.isAnonymous),
      parentId: cleanString(input.parentId) || undefined,
    });
  }

  if (!(await getCloudDocument<Record<string, unknown>>(POST_COLLECTION, postId))) return null;
  const timestamp = new Date().toISOString();
  const payload: Omit<CommentRecord, 'id'> = {
    authorAvatar: input.isAnonymous ? undefined : cleanString(input.authorAvatar) || undefined,
    authorId,
    authorNickname: input.isAnonymous ? '匿名用户' : (cleanString(input.authorNickname) || '微信用户'),
    content,
    createdAt: timestamp,
    isAnonymous: Boolean(input.isAnonymous),
    isLiked: false,
    likes: 0,
    parentId: cleanString(input.parentId) || undefined,
    postId,
    updatedAt: timestamp,
  };
  const commentId = await addCloudDocument(COMMENT_COLLECTION, payload as unknown as Record<string, unknown>);
  try {
    await incrementCloudDocumentFields(
      POST_COLLECTION,
      postId,
      { comments: 1, commentsCount: 1 },
      { updatedAt: timestamp },
    );
  } catch (error) {
    await deleteCloudDocument(COMMENT_COLLECTION, commentId).catch(() => undefined);
    throw error;
  }
  return normalizeComment({ ...payload, _id: commentId, id: commentId });
}

export async function deleteCommunityDataByOpenid(openid: string): Promise<CommunityDeletionResult> {
  const normalizedOpenid = cleanString(openid);
  if (!normalizedOpenid) throw new Error('缺少用户身份');

  if (useMockStore()) {
    const result = mockStore.deleteAccountData(normalizedOpenid);
    return {
      commentsDeleted: result.commentsDeleted,
      failedFileIds: [],
      filesDeleted: result.imageFileIds.length,
      postsDeleted: result.postsDeleted,
    };
  }

  const [authoredPosts, authoredComments] = await Promise.all([
    listRecordsOwnedBy(POST_COLLECTION, normalizedOpenid),
    listRecordsOwnedBy(COMMENT_COLLECTION, normalizedOpenid),
  ]);
  const authoredPostIds = new Set(authoredPosts.map(recordIdentity).filter(Boolean));
  const affectedPostIds = new Set(
    authoredComments
      .map((comment) => cleanString(comment.postId))
      .filter((postId) => postId && !authoredPostIds.has(postId)),
  );
  const imageFileIds = authoredPosts.flatMap((post) => cleanStringArray(post.imageFileIds));
  const fileCleanup = await deleteWechatCloudFiles(imageFileIds);

  let commentsDeleted = 0;
  for (const postId of authoredPostIds) {
    commentsDeleted += await deleteAllDocumentsWhere(COMMENT_COLLECTION, { postId });
  }
  commentsDeleted += await deleteAllDocumentsWhere(COMMENT_COLLECTION, { authorId: normalizedOpenid });
  commentsDeleted += await deleteAllDocumentsWhere(COMMENT_COLLECTION, { _openid: normalizedOpenid });

  let postsDeleted = 0;
  postsDeleted += await deleteAllDocumentsWhere(POST_COLLECTION, { authorId: normalizedOpenid });
  postsDeleted += await deleteAllDocumentsWhere(POST_COLLECTION, { _openid: normalizedOpenid });

  for (const postId of affectedPostIds) await refreshCommentCount(postId);

  return {
    commentsDeleted,
    failedFileIds: fileCleanup.failures,
    filesDeleted: fileCleanup.deleted,
    postsDeleted,
  };
}
