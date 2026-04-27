const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'posters';
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
  const { action, id, data, enabled, token } = event;
  if (!action) {
    return fail('缺少 action 参数');
  }

  try {
    switch (action) {
      case 'list': {
        const query = db.collection(COLLECTION);
        const response = enabled === true ? await query.where({ enabled: true }).orderBy('sort', 'asc').get() : await query.orderBy('sort', 'asc').get();
        return success(response.data);
      }
      case 'get': {
        if (!id) {
          return fail('缺少海报 id');
        }
        const response = await db.collection(COLLECTION).doc(id).get();
        return success(response.data);
      }
      case 'create':
      case 'update':
      case 'delete': {
        const isAdmin = await checkAdmin(token);
        if (!isAdmin) {
          return fail('无管理权限');
        }
        if (action === 'create') {
          if (!data || !data.title || !data.coverImage) {
            return fail('海报标题和封面不能为空');
          }
          const response = await db.collection(COLLECTION).add({ data: { ...data, createdAt: data.createdAt || new Date().toISOString() } });
          return success({ id: response._id });
        }
        if (!id) {
          return fail('缺少海报 id');
        }
        if (action === 'update') {
          await db.collection(COLLECTION).doc(id).update({ data: { ...data, updatedAt: new Date().toISOString() } });
          return success({ id });
        }
        await db.collection(COLLECTION).doc(id).remove();
        return success({ id });
      }
      default:
        return fail(`不支持的 action: ${action}`);
    }
  } catch (error) {
    return fail(error.message || 'poster 云函数执行失败');
  }
};
