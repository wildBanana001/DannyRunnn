import { createDecipheriv, createSign, createVerify, randomUUID } from 'node:crypto';
import axios from 'axios';
import { config } from '../config.js';
const WECHAT_PAY_BASE_URL = 'https://api.mch.weixin.qq.com';
const JSAPI_ORDER_PATH = '/v3/pay/transactions/jsapi';
export class WechatPayApiError extends Error {
    code;
    requestId;
    status;
    constructor(message, options = {}) {
        super(message);
        this.name = 'WechatPayApiError';
        this.code = options.code || 'WECHAT_PAY_ERROR';
        this.requestId = options.requestId || '';
        this.status = options.status || 502;
    }
}
export function isWechatPayConfigured() {
    const { appId, mchId, serialNo, privateKeyBase64, apiV3Key, notifyUrl, payPublicKey, payPublicKeyId, } = config.wechatPay;
    return Boolean(appId
        && mchId
        && serialNo
        && privateKeyBase64
        && apiV3Key
        && notifyUrl
        && payPublicKey
        && payPublicKeyId);
}
function resolvePem(value, missingMessage) {
    if (!value)
        throw new Error(missingMessage);
    if (value.includes('BEGIN') && (value.includes('KEY') || value.includes('CERTIFICATE'))) {
        return value.replace(/\\n/g, '\n');
    }
    const decoded = Buffer.from(value, 'base64').toString('utf-8');
    if (!decoded.includes('BEGIN') || (!decoded.includes('KEY') && !decoded.includes('CERTIFICATE'))) {
        throw new Error(`${missingMessage}，且当前内容不是有效 PEM 或 base64 PEM`);
    }
    return decoded;
}
function resolvePrivateKeyPem() {
    return resolvePem(config.wechatPay.privateKeyBase64, '缺少商户私钥配置 WECHAT_PAY_PRIVATE_KEY');
}
function resolvePayPublicKeyPem() {
    return resolvePem(config.wechatPay.payPublicKey, '缺少微信支付公钥 WECHAT_PAY_PUBLIC_KEY');
}
function createNonceStr() {
    return randomUUID().replace(/-/g, '').toUpperCase();
}
function buildAuthorizationHeader(method, urlPath, body) {
    const { mchId, serialNo } = config.wechatPay;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = createNonceStr();
    const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
    const signature = createSign('RSA-SHA256').update(message).sign(resolvePrivateKeyPem(), 'base64');
    return (`WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",`
        + `nonce_str="${nonceStr}",`
        + `signature="${signature}",`
        + `timestamp="${timestamp}",`
        + `serial_no="${serialNo}"`);
}
function getHeader(response, name) {
    const value = response.headers[name.toLowerCase()];
    return typeof value === 'string' ? value.trim() : '';
}
function parseJsonBody(rawBody) {
    if (!rawBody)
        return {};
    return JSON.parse(rawBody);
}
async function requestWechatPay(method, urlPath, body) {
    const bodyString = body ? JSON.stringify(body) : '';
    const response = await axios.request({
        method,
        url: `${WECHAT_PAY_BASE_URL}${urlPath}`,
        data: body ? bodyString : undefined,
        headers: {
            Authorization: buildAuthorizationHeader(method, urlPath, bodyString),
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            'User-Agent': 'worker_house_bff/1.0',
        },
        responseType: 'text',
        timeout: 10000,
        transformResponse: [(value) => value],
        validateStatus: () => true,
    });
    const rawBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? {});
    const requestId = getHeader(response, 'request-id');
    if (requestId) {
        console.info(`[wechat-pay] request-id=${requestId} status=${response.status} path=${urlPath}`);
    }
    const signatureValid = verifyWechatPaySignature({
        nonce: getHeader(response, 'wechatpay-nonce'),
        rawBody,
        serialNo: getHeader(response, 'wechatpay-serial'),
        signature: getHeader(response, 'wechatpay-signature'),
        timestamp: getHeader(response, 'wechatpay-timestamp'),
    });
    if (!signatureValid) {
        throw new WechatPayApiError('微信支付应答验签失败', { requestId, status: 502 });
    }
    if (response.status < 200 || response.status >= 300) {
        const errorBody = parseJsonBody(rawBody);
        throw new WechatPayApiError(errorBody.message || '微信支付接口请求失败', {
            code: errorBody.code,
            requestId,
            status: response.status,
        });
    }
    return parseJsonBody(rawBody);
}
export async function jsapiUnifiedOrder(input) {
    const { appId, mchId, notifyUrl } = config.wechatPay;
    const requestBody = {
        appid: appId,
        mchid: mchId,
        description: input.description.slice(0, 127),
        out_trade_no: input.outTradeNo,
        time_expire: input.timeExpire,
        notify_url: notifyUrl,
        amount: { total: input.amountTotal, currency: 'CNY' },
        payer: { openid: input.openid },
    };
    if (input.attach)
        requestBody.attach = input.attach.slice(0, 127);
    const result = await requestWechatPay('POST', JSAPI_ORDER_PATH, requestBody);
    if (!result.prepay_id) {
        throw new WechatPayApiError('微信支付统一下单未返回 prepay_id');
    }
    return result.prepay_id;
}
export async function queryWechatPayOrder(outTradeNo) {
    const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.wechatPay.mchId)}`;
    return requestWechatPay('GET', path);
}
export async function closeWechatPayOrder(outTradeNo) {
    const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`;
    await requestWechatPay('POST', path, { mchid: config.wechatPay.mchId });
}
export function buildJsapiPayParams(prepayId) {
    const { appId } = config.wechatPay;
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = createNonceStr();
    const packageValue = `prepay_id=${prepayId}`;
    const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
    const paySign = createSign('RSA-SHA256').update(message).sign(resolvePrivateKeyPem(), 'base64');
    return { timeStamp, nonceStr, package: packageValue, signType: 'RSA', paySign };
}
export function verifyWechatPaySignature(input) {
    const timestamp = Number(input.timestamp);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300)
        return false;
    if (!input.nonce || !input.signature)
        return false;
    if (input.serialNo !== config.wechatPay.payPublicKeyId)
        return false;
    try {
        const message = `${input.timestamp}\n${input.nonce}\n${input.rawBody}\n`;
        const verifier = createVerify('RSA-SHA256');
        verifier.update(message);
        verifier.end();
        return verifier.verify(resolvePayPublicKeyPem(), input.signature, 'base64');
    }
    catch (error) {
        console.error('[wechat-pay] signature verification error', error instanceof Error ? error.message : error);
        return false;
    }
}
export function decryptNotifyResource(resource) {
    const { apiV3Key } = config.wechatPay;
    if (resource.algorithm !== 'AEAD_AES_256_GCM') {
        throw new Error('不支持的微信支付回调加密算法');
    }
    if (!apiV3Key || Buffer.byteLength(apiV3Key, 'utf-8') !== 32) {
        throw new Error('WECHAT_PAY_API_KEY_V3 必须是 32 字节');
    }
    const cipherBuffer = Buffer.from(resource.ciphertext, 'base64');
    if (cipherBuffer.length <= 16)
        throw new Error('微信支付回调密文格式错误');
    const authTag = cipherBuffer.subarray(cipherBuffer.length - 16);
    const encryptedData = cipherBuffer.subarray(0, cipherBuffer.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf-8'), Buffer.from(resource.nonce, 'utf-8'));
    decipher.setAuthTag(authTag);
    if (resource.associated_data)
        decipher.setAAD(Buffer.from(resource.associated_data, 'utf-8'));
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return JSON.parse(decrypted.toString('utf-8'));
}
export function createOutTradeNo() {
    const datePart = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `WH${datePart}${randomUUID().slice(0, 8).toUpperCase()}`;
}
