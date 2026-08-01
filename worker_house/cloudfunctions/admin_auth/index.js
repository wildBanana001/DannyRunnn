const cloud = require('wx-server-sdk');
const { scryptSync, timingSafeEqual } = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'admins';

const success = (data) => ({ success: true, data });
const fail = (error) => ({ success: false, error });
const matchesPassword = (password, passwordHash, passwordSalt) => {
  if (
    typeof passwordHash !== 'string'
    || typeof passwordSalt !== 'string'
    || !/^[a-f0-9]{64}$/i.test(passwordHash)
    || !/^[a-f0-9]{32,}$/i.test(passwordSalt)
  ) {
    return false;
  }
  const derived = scryptSync(password, Buffer.from(passwordSalt, 'hex'), 32);
  return timingSafeEqual(derived, Buffer.from(passwordHash, 'hex'));
};

exports.main = async (event = {}) => {
  const { action, username, password } = event;
  if (action !== 'login') {
    return fail('仅支持 login');
  }
  if (!username || !password) {
    return fail('账号密码不能为空');
  }

  try {
    const response = await db.collection(COLLECTION).where({ username }).limit(1).get();
    const admin = response.data[0];
    if (!admin || !matchesPassword(password, admin.passwordHash, admin.passwordSalt) || !admin.token) {
      return fail('账号或密码错误');
    }
    return success({ token: admin.token, username: admin.username });
  } catch (error) {
    return fail(error.message || 'admin_auth 云函数执行失败');
  }
};
