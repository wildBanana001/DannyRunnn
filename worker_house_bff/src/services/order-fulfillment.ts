import { randomUUID } from 'node:crypto';
import {
  claimOrderFulfillmentReport,
  finishOrderFulfillmentReport,
  getOrderById,
  type OrderRecord,
} from '../data/orders.js';
import { uploadWechatSelfPickupShippingInfo } from '../utils/wechat-order-shipping.js';

const SHIPPING_REPORT_LEASE_MILLISECONDS = 30_000;

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

function assertFulfillableOrder(order: OrderRecord | null): asserts order is OrderRecord {
  if (!order || order.kind !== 'shop') {
    throw new OrderFulfillmentError('ORDER_NOT_FOUND', '商城订单不存在', 404);
  }
  if (order.status !== 'paid') {
    throw new OrderFulfillmentError('ORDER_NOT_PAID', '订单尚未支付，不能确认交付', 409);
  }
  if (order.fulfillmentType !== 'onsite' && order.fulfillmentType !== 'pickup') {
    throw new OrderFulfillmentError('UNSUPPORTED_FULFILLMENT', '该订单不是到店享用或到店自提订单', 409);
  }
}

export async function confirmShopOrderFulfillment(orderId: string, adminOpenid: string) {
  const current = await getOrderById(orderId);
  assertFulfillableOrder(current);

  const token = randomUUID();
  const claim = await claimOrderFulfillmentReport(
    current.id,
    adminOpenid,
    token,
    SHIPPING_REPORT_LEASE_MILLISECONDS,
  );
  if (!claim.order) throw new OrderFulfillmentError('ORDER_NOT_FOUND', '商城订单不存在', 404);
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
      `${message}；到店交付已记录，可在订单管理中重试上报`,
      502,
      failed || claim.order,
    );
  }
}
