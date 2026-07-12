import { Router } from 'express';
import { getProductById, listProducts } from '../data/shop.js';
import {
  createOrder,
  getOrderById,
  getOrdersByOpenid,
  updateOrderStatus,
} from '../data/orders.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import {
  buildJsapiPayParams,
  buildMockPayParams,
  createOutTradeNo,
  decryptNotifyResource,
  isWechatPayConfigured,
  jsapiUnifiedOrder,
  type DecryptedNotifyResource,
} from '../utils/wechat-pay.js';
import { requireWxOpenid, resolveWxOpenid } from './utils.js';

export const shopRouter = Router();

/* ------------------------------- 商品接口 ------------------------------- */

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

/* ------------------------------- 订单查询 ------------------------------- */

// 注意：/orders/mine 必须在其他 /orders/:id 类路由之前定义。
shopRouter.get('/orders/mine', wxCloudrunAuth, (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) {
    return;
  }
  const orders = getOrdersByOpenid(openid);
  response.json({ list: orders, total: orders.length });
});

/* ---------------------------- 微信支付统一下单 ---------------------------- */

shopRouter.post('/orders/pay', wxCloudrunAuth, async (request, response) => {
  try {
    const body = (request.body ?? {}) as {
      productId?: string;
      quantity?: number;
      openid?: string;
      remark?: string;
    };

    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
    const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));
    const openid = (typeof body.openid === 'string' && body.openid.trim()) || resolveWxOpenid(request);
    const remark = typeof body.remark === 'string' ? body.remark.trim() : '';

    if (!productId) {
      response.status(400).json({ message: '缺少 productId' });
      return;
    }
    if (!openid) {
      response.status(400).json({ message: '缺少 openid' });
      return;
    }

    const product = getProductById(productId);
    if (!product) {
      response.status(404).json({ message: '商品不存在' });
      return;
    }

    if (product.stock <= 0) {
      response.status(400).json({ message: '商品库存不足' });
      return;
    }

    // 计算金额，单位：分。
    const amountTotal = Math.round(product.price * quantity * 100);
    if (amountTotal <= 0) {
      response.status(400).json({ message: '订单金额异常' });
      return;
    }

    const outTradeNo = createOutTradeNo();

    // 未配置真实微信支付（本地/开发模式）：返回 mock 支付参数并直接置为已支付。
    if (!isWechatPayConfigured()) {
      const mockPay = buildMockPayParams();
      createOrder({
        id: outTradeNo,
        productId: product.id,
        productName: product.name,
        quantity,
        amount: amountTotal,
        openid,
        remark,
        status: 'paid',
        mock: true,
        prepayId: mockPay.package.replace('prepay_id=', ''),
      });

      response.json({
        ...mockPay,
        outTradeNo,
        amount: amountTotal,
      });
      return;
    }

    // 真实微信支付：调用 JSAPI 统一下单。
    const prepayId = await jsapiUnifiedOrder({
      description: `${product.name} x${quantity}`,
      outTradeNo,
      amountTotal,
      openid,
      attach: remark || undefined,
    });

    createOrder({
      id: outTradeNo,
      productId: product.id,
      productName: product.name,
      quantity,
      amount: amountTotal,
      openid,
      remark,
      status: 'pending',
      mock: false,
      prepayId,
    });

    const payParams = buildJsapiPayParams(prepayId);
    response.json({
      ...payParams,
      outTradeNo,
      amount: amountTotal,
    });
  } catch (error) {
    console.error('[shop] 统一下单失败', error instanceof Error ? error.message : error);
    response.status(500).json({ message: error instanceof Error ? error.message : '统一下单失败' });
  }
});

/* ---------------------------- 微信支付异步回调 ---------------------------- */

shopRouter.post('/orders/notify', (request, response) => {
  try {
    const body = (request.body ?? {}) as {
      resource?: DecryptedNotifyResource;
    };

    if (!body.resource || !body.resource.ciphertext) {
      response.status(400).json({ code: 'FAIL', message: '回调数据格式错误' });
      return;
    }

    // AES-256-GCM 解密回调密文。
    const decrypted = decryptNotifyResource(body.resource);
    const outTradeNo = typeof decrypted.out_trade_no === 'string' ? decrypted.out_trade_no : '';
    const tradeState = typeof decrypted.trade_state === 'string' ? decrypted.trade_state : '';
    const transactionId = typeof decrypted.transaction_id === 'string' ? decrypted.transaction_id : '';

    if (!outTradeNo) {
      response.status(400).json({ code: 'FAIL', message: '缺少 out_trade_no' });
      return;
    }

    const order = getOrderById(outTradeNo);
    if (!order) {
      // 订单不存在也返回 SUCCESS，避免微信持续重试。
      response.json({ code: 'SUCCESS', message: '成功' });
      return;
    }

    const nextStatus = tradeState === 'SUCCESS' ? 'paid' : 'failed';
    updateOrderStatus(outTradeNo, nextStatus, transactionId);

    response.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    console.error('[shop] 支付回调处理失败', error instanceof Error ? error.message : error);
    response.status(500).json({ code: 'FAIL', message: '回调处理失败' });
  }
});
