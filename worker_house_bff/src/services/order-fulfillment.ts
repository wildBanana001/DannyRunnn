import { randomUUID } from 'node:crypto';
import {
  claimOrderFulfillmentReport,
  finishOrderFulfillmentReport,
  getOrderById,
  getOrdersByKind,
  type OrderRecord,
} from '../data/orders.js';
import { uploadWechatSelfPickupShippingInfo } from '../utils/wechat-order-shipping.js';

const SHIPPING_REPORT_LEASE_MILLISECONDS = 30_000;

export type AdminFulfillmentTaskAction = 'fulfill' | 'retry';

export interface AdminFulfillmentTask {
  action: AdminFulfillmentTaskAction;
  amount: number;
  createdAt: string;
  fulfillmentLabel: string;
  fulfillmentStatus: OrderRecord['fulfillmentStatus'];
  id: string;
  kind: OrderRecord['kind'];
  paidAt: string;
  participantContact: string;
  participantName: string;
  quantity: number;
  remark: string;
  title: string;
  unitLabel: string;
  wechatShippingAttempts: number;
  wechatShippingError: string;
  wechatShippingStatus: OrderRecord['wechatShippingStatus'];
}

export class OrderFulfillmentError extends Error {
  readonly code: string;
  readonly order?: OrderRecord;
  readonly status: number;

  constructor(code: string, message: string, status: number, order?: OrderRecord) {
    super(message);
    this.name = 'OrderFulfillmentError';
    this.code = code;
    this.order = order;
    this.status = status;
  }
}

function supportsOnsiteFulfillment(order: OrderRecord) {
  return order.kind === 'activity'
    ? order.fulfillmentType === 'onsite'
    : order.fulfillmentType === 'onsite' || order.fulfillmentType === 'pickup';
}

export function isOutstandingFulfillmentTask(order: OrderRecord) {
  if (order.status !== 'paid' || !supportsOnsiteFulfillment(order)) {
    return false;
  }

  if (order.fulfillmentStatus !== 'fulfilled') {
    return true;
  }

  return order.wechatShippingStatus !== 'reported'
    && order.wechatShippingStatus !== 'not_required';
}

export function toAdminFulfillmentTask(order: OrderRecord): AdminFulfillmentTask {
  const activityRegistration = order.activityRegistration;
  const participantName = activityRegistration?.participantNickname
    || order.address?.name
    || '到店用户';
  const participantContact = [
    activityRegistration?.wechatName,
    activityRegistration?.phone,
    order.address?.phone,
  ].filter(Boolean).join(' · ');

  return {
    action: order.fulfillmentStatus === 'fulfilled' ? 'retry' : 'fulfill',
    amount: order.amount,
    createdAt: order.createdAt,
    fulfillmentLabel: order.fulfillmentLabel,
    fulfillmentStatus: order.fulfillmentStatus,
    id: order.id,
    kind: order.kind,
    paidAt: order.paidAt,
    participantContact,
    participantName,
    quantity: order.quantity,
    remark: order.remark,
    title: activityRegistration?.activityTitle || order.productName,
    unitLabel: order.unitLabel,
    wechatShippingAttempts: order.wechatShippingAttempts,
    wechatShippingError: order.wechatShippingError,
    wechatShippingStatus: order.wechatShippingStatus,
  };
}

export async function listAdminFulfillmentTasks() {
  const [shopOrders, activityOrders] = await Promise.all([
    getOrdersByKind('shop'),
    getOrdersByKind('activity'),
  ]);

  return [...shopOrders, ...activityOrders]
    .filter(isOutstandingFulfillmentTask)
    .sort((first, second) => {
      const firstTime = new Date(first.paidAt || first.createdAt).getTime();
      const secondTime = new Date(second.paidAt || second.createdAt).getTime();
      return secondTime - firstTime;
    })
    .map(toAdminFulfillmentTask);
}

function assertPaidFulfillableOrder(
  order: OrderRecord | null,
  expectedKind: OrderRecord['kind'],
): asserts order is OrderRecord {
  if (!order || order.kind !== expectedKind) {
    throw new OrderFulfillmentError(
      'ORDER_NOT_FOUND',
      expectedKind === 'activity' ? '活动报名不存在' : '商城订单不存在',
      404,
    );
  }
  if (order.status !== 'paid') {
    throw new OrderFulfillmentError('ORDER_NOT_PAID', '订单尚未支付，不能确认交付', 409);
  }
  if (
    (expectedKind === 'activity' && order.fulfillmentType !== 'onsite')
    || (
      expectedKind === 'shop'
      && order.fulfillmentType !== 'onsite'
      && order.fulfillmentType !== 'pickup'
    )
  ) {
    throw new OrderFulfillmentError('UNSUPPORTED_FULFILLMENT', '该订单不是到店享用或到店自提订单', 409);
  }
}

async function confirmOrderFulfillment(
  orderId: string,
  adminOpenid: string,
  expectedKind: OrderRecord['kind'],
) {
  const current = await getOrderById(orderId);
  assertPaidFulfillableOrder(current, expectedKind);

  const token = randomUUID();
  const claim = await claimOrderFulfillmentReport(
    current.id,
    adminOpenid,
    token,
    SHIPPING_REPORT_LEASE_MILLISECONDS,
  );
  if (!claim.order) {
    throw new OrderFulfillmentError(
      'ORDER_NOT_FOUND',
      expectedKind === 'activity' ? '活动报名不存在' : '商城订单不存在',
      404,
    );
  }
  if (!claim.claimed) return claim.order;

  try {
    await uploadWechatSelfPickupShippingInfo(claim.order);
    return await finishOrderFulfillmentReport(claim.order.id, token, { success: true }) || claim.order;
  } catch (error) {
    const message = error instanceof Error ? error.message : '微信订单履约上报失败';
    const failed = await finishOrderFulfillmentReport(claim.order.id, token, {
      success: false,
      error: message,
    });
    throw new OrderFulfillmentError(
      'WECHAT_SHIPPING_REPORT_FAILED',
      `${message}；${expectedKind === 'activity' ? '活动核销' : '到店交付'}已记录，可在管理页面重试上报`,
      502,
      failed || claim.order,
    );
  }
}

export function confirmShopOrderFulfillment(orderId: string, adminOpenid: string) {
  return confirmOrderFulfillment(orderId, adminOpenid, 'shop');
}

export function confirmActivityOrderFulfillment(orderId: string, adminOpenid: string) {
  return confirmOrderFulfillment(orderId, adminOpenid, 'activity');
}

export function confirmAdminFulfillmentTask(
  kind: OrderRecord['kind'],
  orderId: string,
  adminOpenid: string,
) {
  return kind === 'activity'
    ? confirmActivityOrderFulfillment(orderId, adminOpenid)
    : confirmShopOrderFulfillment(orderId, adminOpenid);
}
