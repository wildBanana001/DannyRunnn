const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const COLLECTION = 'activities';
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
  const { action, id, status, data, token, nickname, phone, wechatId } = event;
  if (!action) {
    return fail('缺少 action 参数');
  }

  try {
    switch (action) {
      case 'list': {
        const query = status ? db.collection(COLLECTION).where({ status }) : db.collection(COLLECTION);
        const response = await query.orderBy('startDate', status === 'ended' ? 'desc' : 'asc').get();
        return success(response.data);
      }
      case 'get': {
        if (!id) {
          return fail('缺少活动 id');
        }
        const response = await db.collection(COLLECTION).doc(id).get();
        return success(response.data);
      }
      case 'signup': {
        if (!id && !event.activityId) {
          return fail('缺少活动 id');
        }
        if (!nickname || !phone || !wechatId) {
          return fail('报名信息不完整');
        }
        const activityId = id || event.activityId;
        const signupRecord = {
          activityId,
          nickname,
          phone,
          wechatId,
          status: 'pending_payment_offline',
          createdAt: new Date().toISOString()
        };
        await db.collection(COLLECTION).doc(activityId).update({
          data: {
            currentParticipants: _.inc(1),
            signups: _.push([signupRecord])
          }
        });
        return success({ id: activityId });
      }
      case 'create':
      case 'update':
      case 'delete': {
        const isAdmin = await checkAdmin(token);
        if (!isAdmin) {
          return fail('无管理权限');
        }
        if (action === 'create') {
          if (!data || !data.title || !data.startDate) {
            return fail('活动标题和开始时间不能为空');
          }
          const response = await db.collection(COLLECTION).add({ data: { ...data, createdAt: data.createdAt || new Date().toISOString() } });
          return success({ id: response._id });
        }
        if (!id) {
          return fail('缺少活动 id');
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
    return fail(error.message || 'activity 云函数执行失败');
  }
};
