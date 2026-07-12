import { createDecipheriv, createSign, randomUUID } from 'node:crypto';
import axios from 'axios';
import { config } from '../config.js';

/**
 * 微信支付 JSAPI v3 封装（仅使用 Node 内置 crypto + axios，无额外依赖）。
 * 说明：本文件只读取 WECHAT_PAY_* / WECHAT_APP_ID 等支付相关配置，
 * 不涉及也不会输出任何云托管注入的其他敏感信息。
 */

const WECHAT_PAY_BASE_URL = 'https://api.mch.weixin.qq.com';
const JSAPI_ORDER_PATH = '/v3/pay/transactions/jsapi';

export interface JsapiPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}

export interface UnifiedOrderInput {
  description: string;
  outTradeNo: string;
  amountTotal: number; // 单位：分
  openid: string;
  attach?: string;
}

export interface DecryptedNotifyResource {
  algorithm: string;
  ciphertext: string;
  associated_data?: string;
  nonce: string;
  original_type?: string;
}

/**
 * 判断微信支付是否已完整配置。缺任意一项即视为未配置（走 mock 模式）。
 */
export function isWechatPayConfigured(): boolean {
  const { mchId, serialNo, privateKeyBase64, apiV3Key, notifyUrl } = config.wechatPay;
  return Boolean(mchId && serialNo && privateKeyBase64 && apiV3Key && notifyUrl);
}

function resolvePrivateKeyPem(): string {
  const { privateKeyBase64 } = config.wechatPay;
  if (!privateKeyBase64) {
    throw new Error('缺少商户私钥配置 WECHAT_PAY_PRIVATE_KEY');
  }

  const decoded = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
  // 兼容两种存储方式：base64 编码的 PEM，或直接存放的 PEM 文本。
  if (decoded.includes('BEGIN') && decoded.includes('PRIVATE KEY')) {
    return decoded;
  }
  if (privateKeyBase64.includes('BEGIN') && privateKeyBase64.includes('PRIVATE KEY')) {
    return privateKeyBase64.replace(/\\n/g, '\n');
  }
  return decoded;
}

function createNonceStr(): string {
  return randomUUID().replace(/-/g, '').toUpperCase();
}

/**
 * 生成请求签名并组装 Authorization 头。
 * 签名串格式：HTTPMethod\nURL\ntimestamp\nnonce\nbody\n
 */
function buildAuthorizationHeader(method: string, urlPath: string, body: string): string {
  const { mchId, serialNo } = config.wechatPay;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = createNonceStr();
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;

  const signature = createSign('RSA-SHA256').update(message).sign(resolvePrivateKeyPem(), 'base64');

  return (
    `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",` +
    `nonce_str="${nonceStr}",` +
    `signature="${signature}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${serialNo}"`
  );
}

/**
 * JSAPI 统一下单，返回 prepay_id。
 */
export async function jsapiUnifiedOrder(input: UnifiedOrderInput): Promise<string> {
  const { appId, mchId, notifyUrl } = config.wechatPay;

  const requestBody: Record<string, unknown> = {
    appid: appId,
    mchid: mchId,
    description: input.description,
    out_trade_no: input.outTradeNo,
    notify_url: notifyUrl,
    amount: {
      total: input.amountTotal,
      currency: 'CNY',
    },
    payer: {
      openid: input.openid,
    },
  };

  if (input.attach) {
    requestBody.attach = input.attach;
  }

  const bodyString = JSON.stringify(requestBody);
  const authorization = buildAuthorizationHeader('POST', JSAPI_ORDER_PATH, bodyString);

  const response = await axios.post(`${WECHAT_PAY_BASE_URL}${JSAPI_ORDER_PATH}`, bodyString, {
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'worker_house_bff/1.0',
    },
    timeout: 10000,
  });

  const prepayId = response.data?.prepay_id;
  if (!prepayId) {
    throw new Error('微信支付统一下单未返回 prepay_id');
  }
  return prepayId as string;
}

/**
 * 根据 prepay_id 生成前端拉起支付所需参数（含二次签名 paySign）。
 */
export function buildJsapiPayParams(prepayId: string): JsapiPayParams {
  const { appId } = config.wechatPay;
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = createNonceStr();
  const packageValue = `prepay_id=${prepayId}`;
  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const paySign = createSign('RSA-SHA256').update(message).sign(resolvePrivateKeyPem(), 'base64');

  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: 'RSA',
    paySign,
  };
}

/**
 * 生成 mock 支付参数（未配置真实微信支付时使用），前端可直接进入成功态。
 */
export function buildMockPayParams(): JsapiPayParams & { mock: true } {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = createNonceStr();
  return {
    timeStamp,
    nonceStr,
    package: `prepay_id=mock_${randomUUID().slice(0, 12)}`,
    signType: 'RSA',
    paySign: 'mock_pay_sign',
    mock: true,
  };
}

/**
 * 解密微信支付异步回调 resource（AES-256-GCM）。
 */
export function decryptNotifyResource(resource: DecryptedNotifyResource): Record<string, unknown> {
  const { apiV3Key } = config.wechatPay;
  if (!apiV3Key) {
    throw new Error('缺少 APIv3 密钥配置 WECHAT_PAY_API_KEY_V3');
  }

  const key = Buffer.from(apiV3Key, 'utf-8');
  const cipherBuffer = Buffer.from(resource.ciphertext, 'base64');
  const authTag = cipherBuffer.subarray(cipherBuffer.length - 16);
  const encryptedData = cipherBuffer.subarray(0, cipherBuffer.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce, 'utf-8'));
  decipher.setAuthTag(authTag);
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf-8'));
  }

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8')) as Record<string, unknown>;
}

/**
 * 生成商城订单号（out_trade_no）。
 */
export function createOutTradeNo(): string {
  const datePart = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `WH${datePart}${randomUUID().slice(0, 8)}`;
}
