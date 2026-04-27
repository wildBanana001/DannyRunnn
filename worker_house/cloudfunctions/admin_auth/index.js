const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'admins';
const DEFAULT_ADMIN = {
  username: 'worker_house_admin',
  password: 'worker_house_2026',
  token: 'worker-house-admin-token'
};

const success = (data) => ({ success: true, data });
const fail = (error) => ({ success: false, error });

exports.main = async (event = {}) => {
  const { action, username, password } = event;
  if (action !== 'login') {
    return fail('仅支持 login');
  }
  if (!username || !password) {
    return fail('账号密码不能为空');
  }

  try {
    if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
      return success({ token: DEFAULT_ADMIN.token, username: DEFAULT_ADMIN.username });
    }
    const response = await db.collection(COLLECTION).where({ username, password }).limit(1).get();
    if (!response.data[0]) {
      return fail('账号或密码错误');
    }
    return success({ token: response.data[0].token, username: response.data[0].username });
  } catch (error) {
    return fail(error.message || 'admin_auth 云函数执行失败');
  }
};
