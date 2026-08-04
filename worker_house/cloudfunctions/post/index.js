const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const POST_COLLECTION = 'posts';
const COMMENT_COLLECTION = 'comments';
const ADMIN_COLLECTION = 'admins';
const SERVICE_ADMIN_TOKEN = (process.env.CLOUD_ADMIN_SERVICE_TOKEN || '').trim();
const QUERY_BATCH_SIZE = 100;
const FILE_BATCH_SIZE = 50;

const success = (data) => ({ success: true, data });
const fail = (error) => ({ success: false, error });

async function checkAdmin(token) {
  if (!token) {
    return false;
  }
  if (SERVICE_ADMIN_TOKEN && token === SERVICE_ADMIN_TOKEN) {
    return true;
  }
  const result = await db.collection(ADMIN_COLLECTION).where({ token }).limit(1).get();
  return result.data.length > 0;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

function getContextOpenid() {
  return cleanString(cloud.getWXContext().OPENID);
}

function resolveVerifiedAuthorId(event, fallback) {
  return getContextOpenid()
    || cleanString(event.openid)
    || cleanString(fallback);
}

async function resolveDeletionTarget(event) {
  const contextOpenid = getContextOpenid();
  const requestedOpenid = cleanString(event.openid || event.authorId);
  if (contextOpenid) {
    if (requestedOpenid && requestedOpenid !== contextOpenid) {
      return { error: '只能删除当前账号的数据' };
    }
    return { openid: contextOpenid };
  }

  const serviceAuthorized = await checkAdmin(event.serviceToken);
  if (!serviceAuthorized || !requestedOpenid) {
    return { error: '账号数据删除请求未通过身份校验' };
  }
  return { openid: requestedOpenid };
}

async function deleteCollectionRecords(collectionName, query, onBatch) {
  let deleted = 0;
  while (true) {
    const response = await db.collection(collectionName).where(query).limit(QUERY_BATCH_SIZE).get();
    const records = response.data || [];
    if (!records.length) break;
    if (onBatch) await onBatch(records);
    await Promise.all(records.map((record) => db.collection(collectionName).doc(record._id).remove()));
    deleted += records.length;
    if (records.length < QUERY_BATCH_SIZE) break;
  }
  return deleted;
}

async function refreshPostCommentCounts(postIds) {
  for (const postId of postIds) {
    if (!postId) continue;
    try {
      const [postResponse, countResponse] = await Promise.all([
        db.collection(POST_COLLECTION).doc(postId).get(),
        db.collection(COMMENT_COLLECTION).where({ postId }).count()
      ]);
      if (!postResponse.data) continue;
      const count = Number(countResponse.total || 0);
      await db.collection(POST_COLLECTION).doc(postId).update({
        data: {
          comments: count,
          commentsCount: count,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      // The parent post may have been deleted in the same account cleanup.
    }
  }
}

async function deleteCloudFiles(fileIds) {
  const uniqueFileIds = Array.from(new Set(cleanStringArray(fileIds))).filter((item) => item.startsWith('cloud://'));
  let deleted = 0;
  const failures = [];
  for (let index = 0; index < uniqueFileIds.length; index += FILE_BATCH_SIZE) {
    const fileList = uniqueFileIds.slice(index, index + FILE_BATCH_SIZE);
    try {
      const response = await cloud.deleteFile({ fileList });
      const results = Array.isArray(response.fileList) ? response.fileList : [];
      for (const result of results) {
        const errorMessage = cleanString(result.errMsg).toLowerCase();
        const alreadyMissing = errorMessage.includes('not exist') || errorMessage.includes('不存在');
        if (Number(result.status) === 0 || alreadyMissing) deleted += 1;
        else failures.push(cleanString(result.fileID) || 'unknown');
      }
      if (!results.length) deleted += fileList.length;
    } catch (error) {
      failures.push(...fileList);
    }
  }
  return { deleted, failures };
}

async function deleteAccountData(event) {
  const identity = await resolveDeletionTarget(event);
  if (identity.error) return fail(identity.error);
  const openid = identity.openid;
  const imageFileIds = [];
  const authoredPostIds = new Set();
  let commentsDeleted = 0;

  const collectAuthoredPostBatch = async (posts) => {
    for (const post of posts) {
      authoredPostIds.add(post._id);
      imageFileIds.push(...cleanStringArray(post.imageFileIds));
      commentsDeleted += await deleteCollectionRecords(COMMENT_COLLECTION, { postId: post._id });
    }
  };
  let postsDeleted = 0;
  postsDeleted += await deleteCollectionRecords(
    POST_COLLECTION,
    { authorId: openid },
    collectAuthoredPostBatch
  );
  // Older client-side writes may only have the platform-owned _openid field.
  postsDeleted += await deleteCollectionRecords(
    POST_COLLECTION,
    { _openid: openid },
    collectAuthoredPostBatch
  );

  const affectedPostIds = new Set();
  commentsDeleted += await deleteCollectionRecords(
    COMMENT_COLLECTION,
    { authorId: openid },
    async (comments) => {
      comments.forEach((comment) => {
        if (comment.postId && !authoredPostIds.has(comment.postId)) {
          affectedPostIds.add(comment.postId);
        }
      });
    }
  );
  commentsDeleted += await deleteCollectionRecords(
    COMMENT_COLLECTION,
    { _openid: openid },
    async (comments) => {
      comments.forEach((comment) => {
        if (comment.postId && !authoredPostIds.has(comment.postId)) {
          affectedPostIds.add(comment.postId);
        }
      });
    }
  );
  await refreshPostCommentCounts(affectedPostIds);

  const fileCleanup = await deleteCloudFiles(imageFileIds);
  return success({
    commentsDeleted,
    filesDeleted: fileCleanup.deleted,
    failedFileIds: fileCleanup.failures,
    postsDeleted
  });
}

exports.main = async (event = {}) => {
  const { action, id, data, token, authorId, authorNickname, authorAvatar, content } = event;
  if (!action) {
    return fail('缺少 action 参数');
  }

  try {
    switch (action) {
      case 'list': {
        const response = await db.collection(POST_COLLECTION).orderBy('createdAt', 'desc').get();
        return success(response.data);
      }
      case 'get': {
        if (!id) {
          return fail('缺少留言 id');
        }
        const [postRes, commentRes] = await Promise.all([
          db.collection(POST_COLLECTION).doc(id).get(),
          db.collection(COMMENT_COLLECTION).where({ postId: id }).orderBy('createdAt', 'desc').get()
        ]);
        return success({ post: postRes.data, comments: commentRes.data });
      }
      case 'create': {
        if (!data && !event.content) {
          return fail('留言内容不能为空');
        }
        const source = data || event;
        const verifiedAuthorId = resolveVerifiedAuthorId(event, source.authorId || authorId);
        if (!verifiedAuthorId) return fail('缺少用户身份');
        const timestamp = new Date().toISOString();
        const isAnonymous = !!source.isAnonymous;
        const payload = {
          authorId: verifiedAuthorId,
          authorNickname: isAnonymous ? '匿名用户' : (cleanString(source.authorNickname || authorNickname) || '微信用户'),
          authorAvatar: isAnonymous ? '' : cleanString(source.authorAvatar || authorAvatar),
          title: cleanString(source.title),
          content: cleanString(source.content),
          images: cleanStringArray(source.images),
          imageFileIds: cleanStringArray(source.imageFileIds),
          tags: cleanStringArray(source.tags),
          isAnonymous,
          color: cleanString(source.color),
          likes: 0,
          comments: 0,
          commentsCount: 0,
          isLiked: false,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        if (!payload.content) return fail('留言内容不能为空');
        const response = await db.collection(POST_COLLECTION).add({ data: payload });
        return success({ id: response._id });
      }
      case 'delete':
      case 'pin': {
        const isAdmin = await checkAdmin(token);
        if (!isAdmin) {
          return fail('无管理权限');
        }
        if (!id) {
          return fail('缺少留言 id');
        }
        if (action === 'delete') {
          await db.collection(POST_COLLECTION).doc(id).remove();
          return success({ id });
        }
        await db.collection(POST_COLLECTION).doc(id).update({ data: { pinned: !!event.pinned, updatedAt: new Date().toISOString() } });
        return success({ id });
      }
      case 'like': {
        if (!id) {
          return fail('缺少留言 id');
        }
        await db.collection(POST_COLLECTION).doc(id).update({ data: { likes: _.inc(event.delta || 1), updatedAt: new Date().toISOString() } });
        const response = await db.collection(POST_COLLECTION).doc(id).get();
        return success(response.data);
      }
      case 'comment': {
        if (!id || !content) {
          return fail('评论参数不完整');
        }
        const verifiedAuthorId = resolveVerifiedAuthorId(event, authorId);
        if (!verifiedAuthorId) return fail('缺少用户身份');
        const isAnonymous = !!event.isAnonymous;
        const commentPayload = {
          postId: id,
          authorId: verifiedAuthorId,
          authorNickname: isAnonymous ? '匿名用户' : (cleanString(authorNickname) || '微信用户'),
          authorAvatar: isAnonymous ? '' : cleanString(authorAvatar),
          content: cleanString(content),
          likes: 0,
          isLiked: false,
          isAnonymous,
          parentId: cleanString(event.parentId),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const response = await db.collection(COMMENT_COLLECTION).add({ data: commentPayload });
        await db.collection(POST_COLLECTION).doc(id).update({
          data: {
            comments: _.inc(1),
            commentsCount: _.inc(1),
            updatedAt: new Date().toISOString()
          }
        });
        return success({ ...commentPayload, id: response._id, _id: response._id });
      }
      case 'deleteAccountData':
        return deleteAccountData(event);
      default:
        return fail(`不支持的 action: ${action}`);
    }
  } catch (error) {
    return fail(error.message || 'post 云函数执行失败');
  }
};
