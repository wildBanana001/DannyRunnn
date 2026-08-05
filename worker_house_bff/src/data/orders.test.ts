import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';
import {
  AccountOrderDeletionBlockedError,
  ActivityCapacityExceededError,
  claimOrderFulfillmentReport,
  claimOrderPaymentPreparation,
  createActivityOrderWithCapacity,
  createOrder,
  deleteOrAnonymizeOrdersByOpenid,
  finishOrderPaymentPreparation,
  finishOrderFulfillmentReport,
  getOrderById,
  getOrdersByOpenid,
  getOrdersByProductId,
  settleFreeOrder,
  updateOrderStatus,
} from './orders.js';
import { getActivityById, listActivities } from './activities.js';
import { getProductById, listProducts, normalizeShopProduct } from './shop.js';
import { resolveShopOrderAddress } from '../routes/shop.js';

const storageFilePath = fileURLToPath(new URL('./orders.store.json', import.meta.url));
rmSync(storageFilePath, { force: true });
after(() => rmSync(storageFilePath, { force: true }));

function createPendingOrder(amount = 5_990, id = 'WH0123456789ABCDEF0123456789ABCD') {
  return createOrder({
    id,
    clientRequestId: `shop-request-${id}`,
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
    fulfillmentType: 'delivery',
    fulfillmentLabel: '快递配送',
    unitLabel: '件',
    openid: 'openid-test',
    status: 'pending',
    mock: false,
    expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
  });
}

function buildCapacityActivityOrder(id: string, activityId: string, openid: string) {
  return {
    id,
    kind: 'activity' as const,
    clientRequestId: `request-${id}`,
    productId: activityId,
    productName: '并发名额测试活动',
    productImageUrl: '',
    unitPrice: 9_900,
    quantity: 1,
    amount: 9_900,
    address: null,
    fulfillmentType: 'onsite' as const,
    fulfillmentLabel: '现场参与',
    unitLabel: '位',
    openid,
    status: 'pending' as const,
    mock: false,
    expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
  };
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

test('records onsite fulfillment and serializes WeChat self-pickup reporting', async () => {
  const pending = await createOrder({
    id: 'WHFULFILLMENT0123456789ABCDEF0123',
    clientRequestId: 'shop-fulfillment-request',
    productId: 'cocktail-001',
    productName: '到店测试鸡尾酒',
    productImageUrl: '',
    unitPrice: 1,
    quantity: 1,
    amount: 1,
    address: null,
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    openid: 'openid-fulfillment-test',
    status: 'pending',
    mock: false,
    expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
  });
  assert.equal(pending.wechatShippingStatus, 'not_required');

  const paid = await updateOrderStatus(pending.id, 'paid', { transactionId: 'wx-tx-fulfillment' });
  assert.equal(paid?.wechatShippingStatus, 'pending');

  const claim = await claimOrderFulfillmentReport(pending.id, 'admin-openid', 'report-token-1', 10_000);
  assert.equal(claim.claimed, true);
  assert.equal(claim.reportRequired, true);
  assert.equal(claim.order?.fulfillmentStatus, 'fulfilled');
  assert.equal(claim.order?.fulfilledBy, 'admin-openid');
  assert.equal(claim.order?.wechatShippingStatus, 'reporting');
  assert.equal(claim.order?.wechatShippingAttempts, 1);

  const concurrent = await claimOrderFulfillmentReport(pending.id, 'other-admin', 'report-token-2', 10_000);
  assert.equal(concurrent.claimed, false);
  assert.equal(concurrent.order?.fulfilledBy, 'admin-openid');

  const ignoredFinish = await finishOrderFulfillmentReport(pending.id, 'report-token-2', { success: true });
  assert.equal(ignoredFinish?.wechatShippingStatus, 'reporting');

  const failed = await finishOrderFulfillmentReport(pending.id, 'report-token-1', {
    success: false,
    error: 'temporary failure',
  });
  assert.equal(failed?.wechatShippingStatus, 'failed');
  assert.equal(failed?.wechatShippingError, 'temporary failure');

  const retry = await claimOrderFulfillmentReport(pending.id, 'other-admin', 'report-token-3', 10_000);
  assert.equal(retry.claimed, true);
  assert.equal(retry.order?.wechatShippingAttempts, 2);
  const reported = await finishOrderFulfillmentReport(pending.id, 'report-token-3', { success: true });
  assert.equal(reported?.wechatShippingStatus, 'reported');
  assert.ok(reported?.wechatShippingReportedAt);

  const duplicate = await claimOrderFulfillmentReport(pending.id, 'other-admin', 'report-token-4', 10_000);
  assert.equal(duplicate.claimed, false);
  assert.equal(duplicate.order?.wechatShippingStatus, 'reported');
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
    address: null,
    fulfillmentType: 'onsite',
    fulfillmentLabel: '现场参与',
    unitLabel: '位',
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
  assert.equal(activityOrder.address, null);
  assert.equal(activityOrder.fulfillmentType, 'onsite');
  assert.equal(activityOrder.fulfillmentLabel, '现场参与');
  assert.equal(activityOrder.unitLabel, '位');
  assert.equal(activityOrder.activityRegistration?.profileId, 'profile-001');
  assert.deepEqual((await getOrdersByOpenid('openid-test', 'activity')).map((item) => item.id), [activityOrder.id]);
  assert.deepEqual((await getOrdersByProductId('act-001', 'activity')).map((item) => item.id), [activityOrder.id]);
  assert.equal((await getOrderById(activityOrder.id))?.activityRegistration?.participantNickname, '测试用户');
});

test('records activity check-in before idempotently reporting WeChat self-pickup fulfillment', async () => {
  const activityOrder = await createOrder({
    ...buildCapacityActivityOrder(
      'WAFULFILLMENT0123456789ABCDEF0123',
      'activity-fulfillment-test',
      'openid-activity-fulfillment',
    ),
    productName: '活动履约测试',
  });
  assert.equal(activityOrder.wechatShippingStatus, 'not_required');

  const paid = await updateOrderStatus(activityOrder.id, 'paid', {
    transactionId: 'wx-activity-transaction',
  });
  assert.equal(paid?.fulfillmentStatus, 'pending');
  assert.equal(paid?.wechatShippingStatus, 'pending');

  const claim = await claimOrderFulfillmentReport(
    activityOrder.id,
    'activity-admin-openid',
    'activity-report-token-1',
    10_000,
  );
  assert.equal(claim.claimed, true);
  assert.equal(claim.reportRequired, true);
  assert.equal(claim.order?.fulfillmentStatus, 'fulfilled');
  assert.equal(claim.order?.fulfilledBy, 'activity-admin-openid');
  assert.equal(claim.order?.wechatShippingStatus, 'reporting');
  const fulfilledAt = claim.order?.fulfilledAt;

  const concurrent = await claimOrderFulfillmentReport(
    activityOrder.id,
    'other-activity-admin',
    'activity-report-token-2',
    10_000,
  );
  assert.equal(concurrent.claimed, false);
  assert.equal(concurrent.order?.fulfilledAt, fulfilledAt);
  assert.equal(concurrent.order?.fulfilledBy, 'activity-admin-openid');

  const failed = await finishOrderFulfillmentReport(activityOrder.id, 'activity-report-token-1', {
    success: false,
    error: 'temporary activity reporting failure',
  });
  assert.equal(failed?.fulfillmentStatus, 'fulfilled');
  assert.equal(failed?.wechatShippingStatus, 'failed');

  const retry = await claimOrderFulfillmentReport(
    activityOrder.id,
    'other-activity-admin',
    'activity-report-token-3',
    10_000,
  );
  assert.equal(retry.claimed, true);
  assert.equal(retry.order?.fulfilledAt, fulfilledAt);
  const reported = await finishOrderFulfillmentReport(activityOrder.id, 'activity-report-token-3', {
    success: true,
  });
  assert.equal(reported?.wechatShippingStatus, 'reported');
});

test('completes mock activity check-in without requiring a WeChat shipping report', async () => {
  const mockActivityOrder = await createOrder({
    ...buildCapacityActivityOrder(
      'WAMOCKFULFILLMENT123456789ABCDEF01',
      'activity-mock-fulfillment-test',
      'openid-activity-mock',
    ),
    amount: 1,
    mock: true,
    status: 'paid',
    unitPrice: 1,
  });

  const claim = await claimOrderFulfillmentReport(
    mockActivityOrder.id,
    'activity-admin-openid',
    'activity-mock-report-token',
    10_000,
  );
  assert.equal(claim.claimed, false);
  assert.equal(claim.reportRequired, false);
  assert.equal(claim.order?.fulfillmentStatus, 'fulfilled');
  assert.equal(claim.order?.wechatShippingStatus, 'not_required');
});

test('normalizes legacy shop products and only lists enabled products', () => {
  const legacyProduct = normalizeShopProduct({
    id: 'legacy-product',
    name: '历史商品',
  });
  assert.equal(legacyProduct.fulfillmentType, 'delivery');
  assert.equal(legacyProduct.fulfillmentLabel, '快递配送');
  assert.equal(legacyProduct.unitLabel, '件');
  assert.equal(legacyProduct.alcoholic, false);
  assert.equal(legacyProduct.abv, 0);
  assert.equal(legacyProduct.volumeMl, 0);
  assert.equal(legacyProduct.enabled, true);
  assert.equal('stock' in legacyProduct, false);

  const disabledProduct = normalizeShopProduct({
    id: 'disabled-product',
    enabled: false,
    fulfillmentType: 'pickup',
  });
  assert.equal(disabledProduct.enabled, false);
  assert.equal(disabledProduct.fulfillmentType, 'pickup');
  assert.equal(disabledProduct.fulfillmentLabel, '到店自取');

  const listedProducts = listProducts();
  assert.equal(listedProducts.length, 1);
  const [water] = listedProducts;
  assert.equal(water.id, 'bottled-water-550ml');
  assert.equal(water.name, '瓶装饮用水（550ml）');
  assert.equal(water.price, 1);
  assert.equal(water.originalPrice, 1);
  assert.equal(Math.round(water.price * 100), 100);
  assert.equal(water.category, '饮品');
  assert.equal(water.fulfillmentType, 'pickup');
  assert.equal(water.fulfillmentLabel, '到店自取');
  assert.equal(water.unitLabel, '瓶');
  assert.equal(water.alcoholic, false);
  assert.equal(water.abv, 0);
  assert.equal(water.volumeMl, 550);
  assert.equal(water.enabled, true);
  for (const productId of [
    'cocktail-afterwork-sour',
    'cocktail-mint-mojito',
    'cocktail-berry-fizz',
    'cocktail-sunset-highball',
    'cocktail-espresso-martini',
    'cocktail-elderflower-zero',
  ]) {
    assert.equal(getProductById(productId)?.enabled, false);
  }
  assert.equal(listedProducts.some((item) => item.id === 'prod-coffee-box'), false);
  assert.equal(getProductById('prod-coffee-box')?.enabled, false);
  assert.equal(getProductById(listedProducts[0].id)?.id, listedProducts[0].id);
});

test('requires addresses only for delivery fulfillment', () => {
  const address = {
    name: '测试用户',
    phone: '13800138000',
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    detail: '测试地址',
  };
  assert.deepEqual(resolveShopOrderAddress('delivery', address), address);
  assert.equal(resolveShopOrderAddress('delivery', null), null);
  assert.equal(resolveShopOrderAddress('onsite', address), null);
  assert.equal(resolveShopOrderAddress('pickup', address), null);
});

test('keeps all upcoming activity fixtures at the formal registration price', () => {
  const firstActivity = getActivityById('act-001');
  const secondActivity = getActivityById('act-002');
  const upcomingActivities = listActivities().filter((item) => item.status === 'ongoing' && item.enabled !== false);
  assert.equal(firstActivity?.price, 148);
  assert.equal(secondActivity?.price, 148);
  assert.equal(Math.round((firstActivity?.price ?? 0) * 100), 14_800);
  assert.equal(upcomingActivities.length, 9);
  assert.ok(upcomingActivities.every((item) => item.price === 148));
  assert.ok(upcomingActivities.every((item) => item.originalPrice === 148));
  assert.ok(upcomingActivities.every((item) => item.currentParticipants === 0));
  assert.equal(firstActivity?.startDate, '2026-08-08');
  assert.equal(secondActivity?.startDate, '2026-08-14');
});

test('settles free onsite shop orders without preparing WeChat payment', async () => {
  const timestamp = new Date().toISOString();
  const pendingOrder = await createOrder({
    id: 'WHFREE0123456789ABCDEF0123456789',
    clientRequestId: 'shop-free-onsite-test',
    productId: 'prod-free-onsite',
    productName: '免费到店兑换',
    productImageUrl: '',
    unitPrice: 0,
    quantity: 1,
    amount: 0,
    address: null,
    fulfillmentType: 'onsite',
    fulfillmentLabel: '现场享用',
    unitLabel: '杯',
    openid: 'openid-free-test',
    status: 'pending',
    mock: false,
    expiresAt: timestamp,
  });
  const order = await settleFreeOrder(pendingOrder);

  assert.equal(order.amount, 0);
  assert.equal(order.status, 'paid');
  assert.equal(order.mock, false);
  assert.equal(order.prepayId, '');
  assert.equal(order.paymentPreparationToken, '');
  assert.equal(order.transactionId, `FREE_SHOP_${order.id}`);
  assert.ok(order.paidAt);
  assert.equal(order.address, null);
  assert.equal(order.fulfillmentType, 'onsite');
  assert.equal(order.fulfillmentLabel, '现场享用');
  assert.equal(order.unitLabel, '杯');
});

test('atomically allows only one concurrent activity reservation for the last seat', async () => {
  const activityId = 'act-capacity-race';
  const results = await Promise.allSettled([
    createActivityOrderWithCapacity(
      buildCapacityActivityOrder('WA_CAPACITY_RACE_FIRST', activityId, 'openid-capacity-first'),
      { currentParticipants: 0, maxParticipants: 1 },
    ),
    createActivityOrderWithCapacity(
      buildCapacityActivityOrder('WA_CAPACITY_RACE_SECOND', activityId, 'openid-capacity-second'),
      { currentParticipants: 0, maxParticipants: 1 },
    ),
  ]);

  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  const rejected = results.find((item) => item.status === 'rejected');
  assert.ok(rejected && rejected.status === 'rejected');
  assert.ok(rejected.reason instanceof ActivityCapacityExceededError);
  assert.equal((await getOrdersByProductId(activityId, 'activity')).length, 1);
});

test('keeps concurrent activity reservation retries idempotent', async () => {
  const activityId = 'act-capacity-idempotent';
  const input = buildCapacityActivityOrder(
    'WA_CAPACITY_IDEMPOTENT',
    activityId,
    'openid-capacity-idempotent',
  );
  const [first, duplicate] = await Promise.all([
    createActivityOrderWithCapacity(input, { currentParticipants: 0, maxParticipants: 1 }),
    createActivityOrderWithCapacity(input, { currentParticipants: 0, maxParticipants: 1 }),
  ]);

  assert.equal(duplicate.id, first.id);
  assert.equal((await getOrdersByProductId(activityId, 'activity')).length, 1);
});

test('deduplicates concurrent reservations for the same openid and activity', async () => {
  const activityId = 'act-capacity-openid';
  const openid = 'openid-capacity-shared';
  const [first, duplicate] = await Promise.all([
    createActivityOrderWithCapacity(
      buildCapacityActivityOrder('WA_CAPACITY_OPENID_FIRST', activityId, openid),
      { currentParticipants: 0, maxParticipants: 2 },
    ),
    createActivityOrderWithCapacity(
      buildCapacityActivityOrder('WA_CAPACITY_OPENID_SECOND', activityId, openid),
      { currentParticipants: 0, maxParticipants: 2 },
    ),
  ]);

  assert.equal(duplicate.id, first.id);
  assert.equal((await getOrdersByProductId(activityId, 'activity')).length, 1);
});

test('rejects activity reservations when base participants already fill capacity', async () => {
  const activityId = 'act-capacity-full';
  await assert.rejects(
    createActivityOrderWithCapacity(
      buildCapacityActivityOrder('WA_CAPACITY_FULL', activityId, 'openid-capacity-full'),
      { currentParticipants: 2, maxParticipants: 2 },
    ),
    ActivityCapacityExceededError,
  );
  assert.equal((await getOrdersByProductId(activityId, 'activity')).length, 0);
});

test('keeps expired pending activity orders reserved until they are explicitly closed', async () => {
  const activityId = 'act-capacity-expired-pending';
  const expiredInput = {
    ...buildCapacityActivityOrder(
      'WA_CAPACITY_EXPIRED_PENDING',
      activityId,
      'openid-capacity-expired',
    ),
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  };
  await createActivityOrderWithCapacity(expiredInput, { currentParticipants: 0, maxParticipants: 1 });

  await assert.rejects(
    createActivityOrderWithCapacity(
      buildCapacityActivityOrder(
        'WA_CAPACITY_AFTER_EXPIRED',
        activityId,
        'openid-capacity-after-expired',
      ),
      { currentParticipants: 0, maxParticipants: 1 },
    ),
    ActivityCapacityExceededError,
  );

  await updateOrderStatus(expiredInput.id, 'closed', { failureReason: '报名支付超时' });
  const replacement = await createActivityOrderWithCapacity(
    buildCapacityActivityOrder(
      'WA_CAPACITY_AFTER_CLOSED',
      activityId,
      'openid-capacity-after-closed',
    ),
    { currentParticipants: 0, maxParticipants: 1 },
  );
  assert.equal(replacement.id, 'WA_CAPACITY_AFTER_CLOSED');
});

test('protects paid orders while allowing late payment confirmation', async () => {
  const activityId = 'act-late-payment';
  const input = buildCapacityActivityOrder(
    'WA_LATE_PAYMENT_CONFIRMATION',
    activityId,
    'openid-late-payment',
  );
  const pending = await createActivityOrderWithCapacity(input, { currentParticipants: 0, maxParticipants: 1 });
  await updateOrderStatus(pending.id, 'closed', { failureReason: '支付超时' });

  const paid = await updateOrderStatus(pending.id, 'paid', {
    transactionId: 'wx-transaction-late',
    notifyId: 'notify-late',
  });
  assert.equal(paid?.status, 'paid');
  assert.equal(paid?.transactionId, 'wx-transaction-late');

  const protectedOrder = await updateOrderStatus(pending.id, 'failed', { failureReason: '不应覆盖' });
  assert.equal(protectedOrder?.status, 'paid');
  assert.equal(protectedOrder?.failureReason, '支付超时');

  await assert.rejects(
    updateOrderStatus(pending.id, 'paid', { transactionId: 'wx-transaction-conflict' }),
    /流水号不一致/,
  );
});

test('releases activity capacity after failure and allows the same user to register again', async () => {
  const activityId = 'act-capacity-reopen';
  const openid = 'openid-capacity-reopen';
  const first = await createActivityOrderWithCapacity(
    buildCapacityActivityOrder('WA_CAPACITY_REOPEN_FIRST', activityId, openid),
    { currentParticipants: 0, maxParticipants: 1 },
  );
  await updateOrderStatus(first.id, 'failed', { failureReason: '统一下单失败' });

  const replacement = await createActivityOrderWithCapacity(
    buildCapacityActivityOrder('WA_CAPACITY_REOPEN_SECOND', activityId, openid),
    { currentParticipants: 0, maxParticipants: 1 },
  );
  assert.equal(replacement.id, 'WA_CAPACITY_REOPEN_SECOND');

  const unlimited = await Promise.all([
    createActivityOrderWithCapacity(
      buildCapacityActivityOrder('WA_CAPACITY_UNLIMITED_FIRST', 'act-capacity-unlimited', 'openid-u1'),
      { currentParticipants: 99, maxParticipants: 0 },
    ),
    createActivityOrderWithCapacity(
      buildCapacityActivityOrder('WA_CAPACITY_UNLIMITED_SECOND', 'act-capacity-unlimited', 'openid-u2'),
      { currentParticipants: 99, maxParticipants: 0 },
    ),
  ]);
  assert.equal(unlimited.length, 2);
});

test('clears a payment preparation lease when an order leaves pending state', async () => {
  const order = await createPendingOrder(100, 'WH_CLEAR_PAYMENT_PREPARATION_LEASE');
  const claim = await claimOrderPaymentPreparation(order.id, 'lease-owner', 10_000);
  assert.equal(claim.claimed, true);

  const failed = await updateOrderStatus(order.id, 'failed', { failureReason: '统一下单失败' });
  assert.equal(failed?.paymentPreparationToken, '');
  assert.equal(failed?.paymentPreparingUntil, '');

  const staleFinish = await finishOrderPaymentPreparation(order.id, 'lease-owner', {
    prepayId: 'should-not-be-saved',
    failureReason: '',
  });
  assert.equal(staleFinish?.status, 'failed');
  assert.equal(staleFinish?.prepayId, '');
});

test('deletes disposable orders and irreversibly de-identifies retained payment evidence', async () => {
  const openid = 'openid-account-delete-complete';
  const paidOrder = await createOrder({
    id: 'WH_ACCOUNT_DELETE_PAID_FULFILLED',
    clientRequestId: 'sensitive-client-request-id',
    productId: 'cocktail-account-delete',
    productName: '注销测试鸡尾酒',
    productImageUrl: '',
    unitPrice: 1,
    quantity: 1,
    amount: 1,
    address: {
      name: '需要删除的姓名',
      phone: '13800138000',
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail: '需要删除的地址',
    },
    fulfillmentType: 'delivery',
    fulfillmentLabel: '快递配送',
    unitLabel: '杯',
    openid,
    remark: '需要删除的备注',
    status: 'pending',
    mock: false,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  await updateOrderStatus(paidOrder.id, 'paid', {
    transactionId: 'wx-transaction-must-remain',
    notifyId: 'notify-must-be-removed',
  });
  const fulfillmentClaim = await claimOrderFulfillmentReport(
    paidOrder.id,
    'admin-openid-must-be-removed',
    'account-delete-report-token',
    10_000,
  );
  assert.equal(fulfillmentClaim.claimed, true);
  await finishOrderFulfillmentReport(paidOrder.id, 'account-delete-report-token', { success: true });

  const closedPrepayOrder = await createOrder({
    id: 'WH_ACCOUNT_DELETE_CLOSED_PREPAY',
    clientRequestId: 'closed-prepay-sensitive-request',
    productId: 'cocktail-closed-prepay',
    productName: '已关闭支付订单',
    productImageUrl: '',
    unitPrice: 1,
    quantity: 1,
    amount: 1,
    address: null,
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    openid,
    status: 'closed',
    mock: false,
    prepayId: 'wx-prepay-that-must-be-removed',
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const failedOrder = await createOrder({
    id: 'WH_ACCOUNT_DELETE_FAILED',
    clientRequestId: 'failed-order-request',
    productId: 'cocktail-failed',
    productName: '失败订单',
    productImageUrl: '',
    unitPrice: 1,
    quantity: 1,
    amount: 1,
    address: null,
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    openid,
    status: 'failed',
    mock: false,
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const mockOrder = await createOrder({
    id: 'WH_ACCOUNT_DELETE_MOCK',
    clientRequestId: 'mock-order-request',
    productId: 'cocktail-mock',
    productName: '模拟订单',
    productImageUrl: '',
    unitPrice: 1,
    quantity: 1,
    amount: 1,
    address: null,
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    openid,
    status: 'paid',
    mock: true,
    transactionId: 'mock-transaction',
    paidAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });

  const result = await deleteOrAnonymizeOrdersByOpenid(openid);
  assert.deepEqual(result, { anonymized: 2, deleted: 2 });
  assert.equal((await getOrdersByOpenid(openid)).length, 0);
  assert.equal(await getOrderById(failedOrder.id), null);
  assert.equal(await getOrderById(mockOrder.id), null);

  const retainedPaid = await getOrderById(paidOrder.id);
  assert.ok(retainedPaid);
  assert.match(retainedPaid.openid, /^deleted_[a-f0-9]{32}$/);
  assert.notEqual(retainedPaid.openid, openid);
  assert.equal(retainedPaid.clientRequestId, `deleted-${paidOrder.id}`);
  assert.equal(retainedPaid.address, null);
  assert.equal(retainedPaid.remark, '');
  assert.equal(retainedPaid.prepayId, '');
  assert.equal(retainedPaid.fulfilledBy, '');
  assert.equal(retainedPaid.lastNotifyId, '');
  assert.equal(retainedPaid.transactionId, 'wx-transaction-must-remain');
  assert.equal(retainedPaid.amount, 1);
  assert.equal(retainedPaid.status, 'paid');

  const retainedClosed = await getOrderById(closedPrepayOrder.id);
  assert.ok(retainedClosed);
  assert.match(retainedClosed.openid, /^deleted_[a-f0-9]{32}$/);
  assert.notEqual(retainedClosed.openid, retainedPaid.openid);
  assert.equal(retainedClosed.prepayId, '');
  assert.equal(retainedClosed.status, 'closed');
});

test('blocks account deletion while a real order may still charge or remains unfulfilled', async () => {
  const pendingOpenid = 'openid-account-delete-pending';
  const pendingOrder = await createPendingOrder(1, 'WH_ACCOUNT_DELETE_PENDING_PAYMENT');
  const pendingForTarget = await createOrder({
    ...pendingOrder,
    id: 'WH_ACCOUNT_DELETE_PENDING_TARGET',
    clientRequestId: 'account-delete-pending-target',
    openid: pendingOpenid,
  });

  await assert.rejects(
    deleteOrAnonymizeOrdersByOpenid(pendingOpenid),
    AccountOrderDeletionBlockedError,
  );
  assert.equal((await getOrderById(pendingForTarget.id))?.openid, pendingOpenid);

  await updateOrderStatus(pendingForTarget.id, 'closed', { failureReason: '支付已关闭' });
  assert.deepEqual(
    await deleteOrAnonymizeOrdersByOpenid(pendingOpenid),
    { anonymized: 0, deleted: 1 },
  );

  const paidOpenid = 'openid-account-delete-unfulfilled';
  const paidOrder = await createOrder({
    id: 'WH_ACCOUNT_DELETE_UNFULFILLED',
    clientRequestId: 'account-delete-unfulfilled',
    productId: 'cocktail-unfulfilled',
    productName: '待到店履约订单',
    productImageUrl: '',
    unitPrice: 1,
    quantity: 1,
    amount: 1,
    address: null,
    fulfillmentType: 'onsite',
    fulfillmentLabel: '到店享用',
    unitLabel: '杯',
    openid: paidOpenid,
    status: 'pending',
    mock: false,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  await updateOrderStatus(paidOrder.id, 'paid', { transactionId: 'wx-unfulfilled-payment' });

  await assert.rejects(
    deleteOrAnonymizeOrdersByOpenid(paidOpenid),
    AccountOrderDeletionBlockedError,
  );
  assert.equal((await getOrderById(paidOrder.id))?.openid, paidOpenid);
});
