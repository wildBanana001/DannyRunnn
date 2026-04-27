const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const POST_COLLECTION = 'posts';
const COMMENT_COLLECTION = 'comments';
const ADMIN_COLLECTION = 'admins';
const DEFAULT_ADMIN_TOKEN = 'worker-house-admin-token';

const success = (data) => ({ success: true, data });
const fail = (error) => ({ success: false, error });

async function checkAdmin(token) {
  if (token === DEFAULT_ADMIN_TOKEN) {
    return true;
  }
  const result = await db.collection(ADMIN_COLLECTION).where({ token }).limit(1).get();
  return result.data.length > 0;
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
        const payload = data || {
          authorId,
          authorNickname,
          authorAvatar,
          title: event.title || '',
          content: event.content,
          images: event.images || [],
          tags: event.tags || [],
          isAnonymous: event.isAnonymous,
          color: event.color,
          likes: 0,
          comments: 0,
          commentsCount: 0,
          isLiked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
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
        const commentPayload = {
          postId: id,
          authorId,
          authorNickname,
          authorAvatar,
          content,
          likes: 0,
          isLiked: false,
          isAnonymous: false,
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
      default:
        return fail(`不支持的 action: ${action}`);
    }
  } catch (error) {
    return fail(error.message || 'post 云函数执行失败');
  }
};
