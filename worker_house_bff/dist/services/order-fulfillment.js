import { randomUUID } from 'node:crypto';
import { claimOrderFulfillmentReport, finishOrderFulfillmentReport, getOrderById, } from '../data/orders.js';
import { uploadWechatSelfPickupShippingInfo } from '../utils/wechat-order-shipping.js';
const SHIPPING_REPORT_LEASE_MILLISECONDS = 30_000;
export class OrderFulfillmentError extends Error {
    code;
    order;
    status;
    constructor(code, message, status, order) {
        super(message);
        this.name = 'OrderFulfillmentError';
        this.code = code;
        this.order = order;
        this.status = status;
    }
}
function assertPaidFulfillableOrder(order, expectedKind) {
    if (!order || order.kind !== expectedKind) {
        throw new OrderFulfillmentError('ORDER_NOT_FOUND', expectedKind === 'activity' ? '活动报名不存在' : '商城订单不存在', 404);
    }
    if (order.status !== 'paid') {
        throw new OrderFulfillmentError('ORDER_NOT_PAID', '订单尚未支付，不能确认交付', 409);
    }
    if ((expectedKind === 'activity' && order.fulfillmentType !== 'onsite')
        || (expectedKind === 'shop'
            && order.fulfillmentType !== 'onsite'
            && order.fulfillmentType !== 'pickup')) {
        throw new OrderFulfillmentError('UNSUPPORTED_FULFILLMENT', '该订单不是到店享用或到店自提订单', 409);
    }
}
async function confirmOrderFulfillment(orderId, adminOpenid, expectedKind) {
    const current = await getOrderById(orderId);
    assertPaidFulfillableOrder(current, expectedKind);
    const token = randomUUID();
    const claim = await claimOrderFulfillmentReport(current.id, adminOpenid, token, SHIPPING_REPORT_LEASE_MILLISECONDS);
    if (!claim.order) {
        throw new OrderFulfillmentError('ORDER_NOT_FOUND', expectedKind === 'activity' ? '活动报名不存在' : '商城订单不存在', 404);
    }
    if (!claim.claimed)
        return claim.order;
    try {
        await uploadWechatSelfPickupShippingInfo(claim.order);
        return await finishOrderFulfillmentReport(claim.order.id, token, { success: true }) || claim.order;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : '微信订单履约上报失败';
        const failed = await finishOrderFulfillmentReport(claim.order.id, token, {
            success: false,
            error: message,
        });
        throw new OrderFulfillmentError('WECHAT_SHIPPING_REPORT_FAILED', `${message}；${expectedKind === 'activity' ? '活动核销' : '到店交付'}已记录，可在管理页面重试上报`, 502, failed || claim.order);
    }
}
export function confirmShopOrderFulfillment(orderId, adminOpenid) {
    return confirmOrderFulfillment(orderId, adminOpenid, 'shop');
}
export function confirmActivityOrderFulfillment(orderId, adminOpenid) {
    return confirmOrderFulfillment(orderId, adminOpenid, 'activity');
}
