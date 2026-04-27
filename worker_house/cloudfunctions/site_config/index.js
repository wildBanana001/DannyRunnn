const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'site_config';
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
  const { action, data, token } = event;
  if (!action) {
    return fail('缺少 action 参数');
  }

  try {
    if (action === 'get') {
      const response = await db.collection(COLLECTION).limit(1).get();
      return success(response.data[0] || null);
    }

    if (action === 'update') {
      const isAdmin = await checkAdmin(token);
      if (!isAdmin) {
        return fail('无管理权限');
      }
      if (!data) {
        return fail('缺少站点配置');
      }
      const current = await db.collection(COLLECTION).limit(1).get();
      if (current.data[0]) {
        await db.collection(COLLECTION).doc(current.data[0]._id).update({ data: { ...data, updatedAt: new Date().toISOString() } });
        return success({ id: current.data[0]._id });
      }
      const response = await db.collection(COLLECTION).add({ data: { ...data, createdAt: new Date().toISOString() } });
      return success({ id: response._id });
    }

    return fail(`不支持的 action: ${action}`);
  } catch (error) {
    return fail(error.message || 'site_config 云函数执行失败');
  }
};
