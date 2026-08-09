import assert from 'node:assert/strict';
import test from 'node:test';
import type { OrderRecord } from '../data/orders.js';
import {
  isOutstandingFulfillmentTask,
  toAdminFulfillmentTask,
} from './order-fulfillment.js';

function buildOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'WA-fulfillment-task-001',
    kind: 'activity',
    clientRequestId: 'fulfillment-task-request-001',
    productId: 'activity-001',
    productName: '线下活动',
    productImageUrl: '',
    unitPrice: 1,
    quantity: 1,
    amount: 1,
    address: null,
    fulfillmentType: 'onsite',
    fulfillmentLabel: '现场参与',
    fulfillmentStatus: 'pending',
    fulfilledAt: '',
    fulfilledBy: '',
    wechatShippingStatus: 'pending',
    wechatShippingReportedAt: '',
    wechatShippingError: '',
    wechatShippingAttempts: 0,
    wechatShippingReportToken: '',
    wechatShippingReportingUntil: '',
    unitLabel: '位',
    openid: 'openid-participant',
    remark: '第一次参加',
    activityRegistration: {
      activityId: 'activity-001',
      activityTitle: 'Deeptalk｜幸福的奥义',
      activityCover: '',
      profileId: 'profile-001',
      participantNickname: '橙子',
      wechatName: 'orange-worker',
      phone: '13800138000',
      profileSnapshot: {
        nickname: '橙子',
        gender: 'other',
        ageRange: '',
        industry: '',
        occupation: '',
        city: '上海',
        socialGoal: '',
        introduction: '',
      },
    },
    status: 'paid',
    mock: false,
    prepayId: '',
    paymentPreparationToken: '',
    paymentPreparingUntil: '',
    transactionId: 'wx-transaction-001',
    paidAt: '2026-08-09T12:00:00.000Z',
    expiresAt: '2026-08-09T12:15:00.000Z',
    failureReason: '',
    lastNotifyId: '',
    createdAt: '2026-08-09T11:58:00.000Z',
    updatedAt: '2026-08-09T12:00:00.000Z',
    ...overrides,
  };
}

test('only exposes paid onsite orders that still need fulfillment work', () => {
  assert.equal(isOutstandingFulfillmentTask(buildOrder()), true);
  assert.equal(isOutstandingFulfillmentTask(buildOrder({ status: 'pending' })), false);
  assert.equal(isOutstandingFulfillmentTask(buildOrder({ fulfillmentType: 'delivery' })), false);
  assert.equal(isOutstandingFulfillmentTask(buildOrder({
    fulfillmentStatus: 'fulfilled',
    wechatShippingStatus: 'failed',
  })), true);
  assert.equal(isOutstandingFulfillmentTask(buildOrder({
    fulfillmentStatus: 'fulfilled',
    wechatShippingStatus: 'reported',
  })), false);
  assert.equal(isOutstandingFulfillmentTask(buildOrder({
    fulfillmentStatus: 'fulfilled',
    mock: true,
    wechatShippingStatus: 'not_required',
  })), false);
});

test('builds a compact admin fulfillment task with participant details', () => {
  const task = toAdminFulfillmentTask(buildOrder());
  assert.equal(task.action, 'fulfill');
  assert.equal(task.kind, 'activity');
  assert.equal(task.title, 'Deeptalk｜幸福的奥义');
  assert.equal(task.participantName, '橙子');
  assert.equal(task.participantContact, 'orange-worker · 13800138000');

  const retryTask = toAdminFulfillmentTask(buildOrder({
    fulfillmentStatus: 'fulfilled',
    wechatShippingError: '微信接口暂时不可用',
    wechatShippingStatus: 'failed',
  }));
  assert.equal(retryTask.action, 'retry');
  assert.equal(retryTask.wechatShippingError, '微信接口暂时不可用');
});
