import { Router, type Response } from 'express';
import { config } from '../config.js';
import { getProductById, listProducts } from '../data/shop.js';
import {
  createOrder,
  getOrderByClientRequestId,
  getOrderById,
  getOrdersByOpenid,
  updateOrderPayment,
  updateOrderStatus,
  type OrderAddressSnapshot,
  type OrderRecord,
} from '../data/orders.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import {
  buildJsapiPayParams,
  closeWechatPayOrder,
  createOutTradeNo,
  decryptNotifyResource,
  isWechatPayConfigured,
  jsapiUnifiedOrder,
  queryWechatPayOrder,
  verifyWechatPaySignature,
  WechatPayApiError,
  type DecryptedNotifyResource,
  type WechatPayOrderResult,
} from '../utils/wechat-pay.js';
import { requireWxOpenid } from './utils.js';

export const shopRouter = Router();

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: string;
  }
}

const PAYMENT_EXPIRE_MINUTES = 15;
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function sanitizeString(value: unknown, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseQuantity(value: unknown) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99 ? quantity : null;
}

function parseAddress(value: unknown): OrderAddressSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const address: OrderAddressSnapshot = {
    name: sanitizeString(input.name, 50),
    phone: sanitizeString(input.phone, 30),
    province: sanitizeString(input.province, 50),
    city: sanitizeString(input.city, 50),
    district: sanitizeString(input.district, 50),
    detail: sanitizeString(input.detail, 160),
  };
  if (!address.name || !address.phone || !address.detail || !/^[0-9+\-\s]{6,30}$/.test(address.phone)) {
    return null;
  }
  return address;
}

function buildExpiresAt() {
  return new Date(Date.now() + PAYMENT_EXPIRE_MINUTES * 60 * 1000).toISOString();
}

function isExpired(order: OrderRecord) {
  return Boolean(order.expiresAt && new Date(order.expiresAt).getTime() <= Date.now());
}

function toPaymentSession(order: OrderRecord) {
  return {
    outTradeNo: order.id,
    amount: order.amount,
    status: order.status,
    mock: order.mock,
    ...(
      order.status === 'pending' && order.prepayId && !order.mock
        ? { payment: buildJsapiPayParams(order.prepayId) }
        : {}
    ),
  };
}

function validateWechatOrder(order: OrderRecord, result: WechatPayOrderResult) {
  if (result.appid && result.appid !== config.wechatPay.appId) throw new Error('微信支付订单 appid 不匹配');
  if (result.mchid && result.mchid !== config.wechatPay.mchId) throw new Error('微信支付订单 mchid 不匹配');
  if (result.out_trade_no && result.out_trade_no !== order.id) throw new Error('微信支付商户订单号不匹配');
  if (Number(result.amount?.total) !== order.amount) throw new Error('微信支付订单金额不匹配');
  if (result.amount?.currency && result.amount.currency !== 'CNY') throw new Error('微信支付订单币种不匹配');
}

function applyWechatOrderState(order: OrderRecord, result: WechatPayOrderResult): OrderRecord {
  validateWechatOrder(order, result);
  if (result.trade_state === 'SUCCESS') {
    return updateOrderStatus(order.id, 'paid', {
      transactionId: result.transaction_id,
      paidAt: result.success_time,
    }) || order;
  }
  if (result.trade_state === 'CLOSED' || result.trade_state === 'REVOKED') {
    return updateOrderStatus(order.id, 'closed', { failureReason: result.trade_state_desc }) || order;
  }
  if (result.trade_state === 'PAYERROR') {
    return updateOrderStatus(order.id, 'failed', { failureReason: result.trade_state_desc }) || order;
  }
  return order;
}

async function refreshWechatOrder(order: OrderRecord): Promise<OrderRecord> {
  if (order.mock || order.status !== 'pending' || !isWechatPayConfigured()) return order;
  try {
    return applyWechatOrderState(order, await queryWechatPayOrder(order.id));
  } catch (error) {
    if (error instanceof WechatPayApiError && error.code === 'ORDER_NOT_EXIST') return order;
    console.warn(`[shop] query order failed id=${order.id}`, error instanceof Error ? error.message : error);
    return order;
  }
}

function assertOrderOwner(order: OrderRecord | null, openid: string, response: Response): order is OrderRecord {
  if (!order) {
    response.status(404).json({ message: '订单不存在' });
    return false;
  }
  if (order.openid !== openid) {
    response.status(403).json({ message: '无权访问该订单' });
    return false;
  }
  return true;
}

async function prepareRealPayment(order: OrderRecord): Promise<OrderRecord> {
  if (order.prepayId) return order;
  const prepayId = await jsapiUnifiedOrder({
    description: `${order.productName} x${order.quantity}`,
    outTradeNo: order.id,
    amountTotal: order.amount,
    openid: order.openid,
    timeExpire: order.expiresAt,
    attach: 'worker-house-shop',
  });
  return updateOrderPayment(order.id, { prepayId, failureReason: '' }) || order;
}

shopRouter.get('/products', (_request, response) => {
  const products = listProducts();
  response.json({ list: products, total: products.length });
});

shopRouter.get('/products/:id', (request, response) => {
  const product = getProductById(String(request.params.id));
  if (!product) {
    response.status(404).json({ message: '商品不存在' });
    return;
  }
  response.json(product);
});

shopRouter.get('/orders/mine', wxCloudrunAuth, async (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) return;

  const orders = getOrdersByOpenid(openid);
  const pendingOrders = orders.filter((item) => item.status === 'pending').slice(0, 3);
  if (pendingOrders.length > 0 && config.cloudMode !== 'mock' && isWechatPayConfigured()) {
    await Promise.allSettled(pendingOrders.map((item) => refreshWechatOrder(item)));
  }
  const refreshedOrders = getOrdersByOpenid(openid);
  response.json({ list: refreshedOrders, total: refreshedOrders.length });
});

shopRouter.get('/orders/:id', wxCloudrunAuth, async (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) return;
  const order = getOrderById(String(request.params.id));
  if (!assertOrderOwner(order, openid, response)) return;
  response.json(await refreshWechatOrder(order));
});

shopRouter.post('/orders/pay', wxCloudrunAuth, async (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) return;

  try {
    const productId = sanitizeString(request.body?.productId, 80);
    const quantity = parseQuantity(request.body?.quantity);
    const address = parseAddress(request.body?.address);
    const remark = sanitizeString(request.body?.remark, 80);
    const clientRequestId = sanitizeString(request.body?.clientRequestId, 64);

    if (!productId || !quantity || !address || !CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
      response.status(400).json({ message: '订单参数不完整或格式错误' });
      return;
    }

    const product = getProductById(productId);
    if (!product) {
      response.status(404).json({ message: '商品不存在' });
      return;
    }
    if (product.stock <= 0 || quantity > product.stock) {
      response.status(409).json({ message: '商品库存不足' });
      return;
    }

    const unitPrice = Math.round(product.price * 100);
    const amount = unitPrice * quantity;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      response.status(400).json({ message: '订单金额异常' });
      return;
    }

    const existing = getOrderByClientRequestId(openid, clientRequestId);
    if (existing) {
      if (existing.productId !== productId || existing.quantity !== quantity || existing.amount !== amount) {
        response.status(409).json({ message: '重复请求与原订单信息不一致，请刷新页面重试' });
        return;
      }
      if (existing.status === 'paid') {
        response.json(toPaymentSession(existing));
        return;
      }
      if (existing.status !== 'pending' || isExpired(existing)) {
        response.status(409).json({ message: '原订单已失效，请刷新页面重新下单' });
        return;
      }
      const prepared = config.cloudMode === 'mock' ? existing : await prepareRealPayment(existing);
      response.json(toPaymentSession(prepared));
      return;
    }

    const expiresAt = buildExpiresAt();
    const outTradeNo = createOutTradeNo();
    const isMockPayment = config.cloudMode === 'mock';

    if (!isMockPayment && !isWechatPayConfigured()) {
      response.status(503).json({ message: '微信支付尚未完成配置，请联系管理员' });
      return;
    }

    let order = createOrder({
      id: outTradeNo,
      clientRequestId,
      productId: product.id,
      productName: product.name,
      productImageUrl: product.imageUrl,
      unitPrice,
      quantity,
      amount,
      address,
      openid,
      remark,
      status: isMockPayment ? 'paid' : 'pending',
      mock: isMockPayment,
      transactionId: isMockPayment ? `MOCK_TX_${Date.now()}` : '',
      paidAt: isMockPayment ? new Date().toISOString() : '',
      expiresAt,
    });

    if (!isMockPayment) {
      order = await prepareRealPayment(order);
    }
    response.json(toPaymentSession(order));
  } catch (error) {
    console.error('[shop] create payment failed', error instanceof Error ? error.message : error);
    const status = error instanceof WechatPayApiError ? 502 : 500;
    response.status(status).json({ message: '支付订单创建失败，请稍后重试' });
  }
});

shopRouter.post('/orders/:id/retry', wxCloudrunAuth, async (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) return;
  const order = getOrderById(String(request.params.id));
  if (!assertOrderOwner(order, openid, response)) return;

  const refreshed = await refreshWechatOrder(order);
  if (refreshed.status === 'paid') {
    response.json(toPaymentSession(refreshed));
    return;
  }
  if (refreshed.status !== 'pending') {
    response.status(409).json({ message: '该订单当前无法继续支付' });
    return;
  }
  if (isExpired(refreshed)) {
    if (!refreshed.mock && isWechatPayConfigured()) {
      try {
        await closeWechatPayOrder(refreshed.id);
      } catch (error) {
        console.warn(`[shop] close expired order failed id=${refreshed.id}`, error instanceof Error ? error.message : error);
      }
    }
    updateOrderStatus(refreshed.id, 'closed', { failureReason: '订单支付超时' });
    response.status(409).json({ message: '订单已超时，请重新下单' });
    return;
  }

  try {
    response.json(toPaymentSession(refreshed.mock ? refreshed : await prepareRealPayment(refreshed)));
  } catch (error) {
    console.error('[shop] retry payment failed', error instanceof Error ? error.message : error);
    response.status(502).json({ message: '暂时无法继续支付，请稍后重试' });
  }
});

shopRouter.post('/orders/notify', (request, response) => {
  try {
    if (!isWechatPayConfigured()) {
      response.status(503).json({ code: 'FAIL', message: '微信支付尚未完成配置' });
      return;
    }

    const signatureValid = verifyWechatPaySignature({
      nonce: request.header('wechatpay-nonce')?.trim() || '',
      rawBody: request.rawBody || '',
      serialNo: request.header('wechatpay-serial')?.trim() || '',
      signature: request.header('wechatpay-signature')?.trim() || '',
      timestamp: request.header('wechatpay-timestamp')?.trim() || '',
    });
    if (!signatureValid) {
      response.status(401).json({ code: 'FAIL', message: '微信支付回调验签失败' });
      return;
    }

    const body = (request.body ?? {}) as {
      id?: string;
      event_type?: string;
      resource?: DecryptedNotifyResource;
    };
    if (!body.id || !body.resource?.ciphertext) {
      response.status(400).json({ code: 'FAIL', message: '回调数据格式错误' });
      return;
    }
    if (body.event_type && body.event_type !== 'TRANSACTION.SUCCESS') {
      response.status(400).json({ code: 'FAIL', message: '不支持的支付通知类型' });
      return;
    }
    if (body.resource.original_type && body.resource.original_type !== 'transaction') {
      response.status(400).json({ code: 'FAIL', message: '支付通知资源类型错误' });
      return;
    }

    const decrypted = decryptNotifyResource(body.resource);
    const outTradeNo = sanitizeString(decrypted.out_trade_no, 32);
    const tradeState = sanitizeString(decrypted.trade_state, 32);
    const transactionId = sanitizeString(decrypted.transaction_id, 64);
    const order = getOrderById(outTradeNo);
    if (!order) {
      response.status(404).json({ code: 'FAIL', message: '商户订单不存在' });
      return;
    }
    if (order.lastNotifyId === body.id) {
      response.status(204).send();
      return;
    }

    const amount = decrypted.amount && typeof decrypted.amount === 'object'
      ? decrypted.amount as { total?: unknown; currency?: unknown }
      : {};
    const appid = sanitizeString(decrypted.appid, 64);
    const mchid = sanitizeString(decrypted.mchid, 64);
    if (
      appid !== config.wechatPay.appId
      || mchid !== config.wechatPay.mchId
      || Number(amount.total) !== order.amount
      || (amount.currency && amount.currency !== 'CNY')
    ) {
      response.status(400).json({ code: 'FAIL', message: '支付回调业务数据不匹配' });
      return;
    }

    if (tradeState !== 'SUCCESS' || !transactionId) {
      response.status(400).json({ code: 'FAIL', message: '支付状态不是成功' });
      return;
    }

    updateOrderStatus(outTradeNo, 'paid', {
      transactionId,
      paidAt: sanitizeString(decrypted.success_time, 64),
      notifyId: body.id,
    });
    response.status(204).send();
  } catch (error) {
    console.error('[shop] payment notify failed', error instanceof Error ? error.message : error);
    response.status(500).json({ code: 'FAIL', message: '回调处理失败' });
  }
});
