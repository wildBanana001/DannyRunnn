import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';
import {
  claimOrderPaymentPreparation,
  createOrder,
  finishOrderPaymentPreparation,
  getOrderById,
  getOrdersByOpenid,
  getOrdersByProductId,
} from './orders.js';

const storageFilePath = fileURLToPath(new URL('./orders.store.json', import.meta.url));
rmSync(storageFilePath, { force: true });
after(() => rmSync(storageFilePath, { force: true }));

function createPendingOrder(amount = 5_990) {
  return createOrder({
    id: 'WH0123456789ABCDEF0123456789ABCD',
    clientRequestId: 'shop-request-lock-test',
    productId: 'prod-coffee-box',
    productName: '测试商品',
    productImageUrl: '',
    unitPrice: amount,
    quantity: 1,
    amount,
    address: {
      name: '测试用户',
      phone: '13800138000',
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail: '测试地址',
    },
    openid: 'openid-test',
    status: 'pending',
    mock: false,
    expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
  });
}

test('keeps order creation idempotent and serializes prepay_id preparation', async () => {
  const created = await createPendingOrder();
  const duplicate = await createPendingOrder(1);
  assert.equal(duplicate.id, created.id);
  assert.equal(duplicate.amount, created.amount);

  const firstClaim = await claimOrderPaymentPreparation(created.id, 'token-first', 10_000);
  assert.equal(firstClaim.claimed, true);

  const concurrentClaim = await claimOrderPaymentPreparation(created.id, 'token-second', 10_000);
  assert.equal(concurrentClaim.claimed, false);
  assert.equal(concurrentClaim.order?.prepayId, '');

  const ignoredFinish = await finishOrderPaymentPreparation(created.id, 'token-second', {
    prepayId: 'wx-should-not-win',
    failureReason: '',
  });
  assert.equal(ignoredFinish?.prepayId, '');

  const completed = await finishOrderPaymentPreparation(created.id, 'token-first', {
    prepayId: 'wx-prepay-id',
    failureReason: '',
  });
  assert.equal(completed?.prepayId, 'wx-prepay-id');
  assert.equal(completed?.paymentPreparationToken, '');

  const afterCompletion = await claimOrderPaymentPreparation(created.id, 'token-third', 10_000);
  assert.equal(afterCompletion.claimed, false);
  assert.equal(afterCompletion.order?.prepayId, 'wx-prepay-id');
});

test('stores activity registrations separately from shop orders', async () => {
  const activityOrder = await createOrder({
    id: 'WA0123456789ABCDEF0123456789ABCD',
    kind: 'activity',
    clientRequestId: 'activity-request-test',
    productId: 'act-001',
    productName: '测试活动',
    productImageUrl: '',
    unitPrice: 12_800,
    quantity: 1,
    amount: 12_800,
    address: { name: '', phone: '', province: '', city: '', district: '', detail: '' },
    openid: 'openid-test',
    status: 'pending',
    mock: false,
    expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
    activityRegistration: {
      activityId: 'act-001',
      activityTitle: '测试活动',
      activityCover: '',
      profileId: 'profile-001',
      participantNickname: '测试用户',
      wechatName: 'test-wechat',
      phone: '13800138000',
      profileSnapshot: {
        nickname: '测试用户',
        gender: 'other',
        ageRange: '',
        industry: '',
        occupation: '',
        city: '深圳',
        socialGoal: '',
        introduction: '',
      },
    },
  });

  assert.equal(activityOrder.kind, 'activity');
  assert.equal(activityOrder.activityRegistration?.profileId, 'profile-001');
  assert.deepEqual((await getOrdersByOpenid('openid-test', 'activity')).map((item) => item.id), [activityOrder.id]);
  assert.deepEqual((await getOrdersByProductId('act-001', 'activity')).map((item) => item.id), [activityOrder.id]);
  assert.equal((await getOrderById(activityOrder.id))?.activityRegistration?.participantNickname, '测试用户');
});
