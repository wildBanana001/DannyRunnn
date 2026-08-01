import {
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomUUID,
  X509Certificate,
} from 'node:crypto';
import axios, { type AxiosResponse } from 'axios';
import { config } from '../config.js';

const WECHAT_PAY_BASE_URL = 'https://api.mch.weixin.qq.com';
const JSAPI_ORDER_PATH = '/v3/pay/transactions/jsapi';
const SECURITY_ECHO_PATH = '/v3/security/echo';

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
  amountTotal: number;
  openid: string;
  timeExpire: string;
  attach?: string;
}

export interface DecryptedNotifyResource {
  algorithm: string;
  ciphertext: string;
  associated_data?: string;
  nonce: string;
  original_type?: string;
}

export interface WechatPaySignatureInput {
  nonce: string;
  rawBody: string;
  serialNo: string;
  signature: string;
  timestamp: string;
}

export interface WechatPayOrderResult {
  appid?: string;
  mchid?: string;
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  trade_state_desc?: string;
  trade_type?: string;
  success_time?: string;
  amount?: {
    total?: number;
    payer_total?: number;
    currency?: string;
    payer_currency?: string;
  };
}

export interface WechatPayConfigurationInput {
  appId: string;
  mchId: string;
  serialNo: string;
  privateKeyBase64: string;
  apiV3Key: string;
  notifyUrl: string;
  payPublicKey: string;
  payPublicKeyId: string;
}

export interface WechatPayConfigurationStatus {
  ready: boolean;
  keyMode: 'public-key' | 'platform-certificate' | 'unknown';
  issues: string[];
}

export class WechatPayApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  readonly status: number;

  constructor(message: string, options: { code?: string; requestId?: string; status?: number } = {}) {
    super(message);
    this.name = 'WechatPayApiError';
    this.code = options.code || 'WECHAT_PAY_ERROR';
    this.requestId = options.requestId || '';
    this.status = options.status || 502;
  }
}

function resolvePem(value: string, missingMessage: string): string {
  if (!value) throw new Error(missingMessage);
  if (value.includes('BEGIN') && (value.includes('KEY') || value.includes('CERTIFICATE'))) {
    return value.replace(/\\n/g, '\n');
  }

  const decoded = Buffer.from(value, 'base64').toString('utf-8');
  if (!decoded.includes('BEGIN') || (!decoded.includes('KEY') && !decoded.includes('CERTIFICATE'))) {
    throw new Error(`${missingMessage}，且当前内容不是有效 PEM 或 base64 PEM`);
  }
  return decoded;
}

function getPayKeyMode(payPublicKeyId: string): WechatPayConfigurationStatus['keyMode'] {
  if (/^PUB_KEY_ID_[A-Za-z0-9]{8,128}$/.test(payPublicKeyId)) return 'public-key';
  if (/^[A-Fa-f0-9]{16,64}$/.test(payPublicKeyId)) return 'platform-certificate';
  return 'unknown';
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

function parsePayPublicKey(value: string) {
  const pem = resolvePem(value, '微信支付公钥无效');
  return pem.includes('BEGIN CERTIFICATE')
    ? new X509Certificate(pem).publicKey
    : createPublicKey(pem);
}

export function inspectWechatPayConfiguration(
  input: WechatPayConfigurationInput,
): WechatPayConfigurationStatus {
  const issues: string[] = [];
  const required = [
    ['WECHAT_APP_ID', input.appId],
    ['WECHAT_PAY_MCH_ID', input.mchId],
    ['WECHAT_PAY_SERIAL_NO', input.serialNo],
    ['WECHAT_PAY_PRIVATE_KEY', input.privateKeyBase64],
    ['WECHAT_PAY_API_KEY_V3', input.apiV3Key],
    ['WECHAT_PAY_NOTIFY_URL', input.notifyUrl],
    ['WECHAT_PAY_PUBLIC_KEY', input.payPublicKey],
    ['WECHAT_PAY_PUBLIC_KEY_ID', input.payPublicKeyId],
  ] as const;

  for (const [name, value] of required) {
    if (!value) issues.push(`${name}:missing`);
  }

  if (input.appId && !/^wx[0-9a-fA-F]{16}$/.test(input.appId)) {
    issues.push('WECHAT_APP_ID:invalid');
  }
  if (input.mchId && !/^\d{8,32}$/.test(input.mchId)) {
    issues.push('WECHAT_PAY_MCH_ID:invalid');
  }
  if (input.serialNo && !/^[A-Fa-f0-9]{16,64}$/.test(input.serialNo)) {
    issues.push('WECHAT_PAY_SERIAL_NO:invalid');
  }
  if (input.apiV3Key && Buffer.byteLength(input.apiV3Key, 'utf-8') !== 32) {
    issues.push('WECHAT_PAY_API_KEY_V3:invalid_length');
  }
  if (input.notifyUrl && !isValidHttpsUrl(input.notifyUrl)) {
    issues.push('WECHAT_PAY_NOTIFY_URL:invalid');
  }

  const keyMode = getPayKeyMode(input.payPublicKeyId);
  if (input.payPublicKeyId && keyMode === 'unknown') {
    issues.push('WECHAT_PAY_PUBLIC_KEY_ID:invalid');
  }

  if (input.privateKeyBase64) {
    try {
      const key = createPrivateKey(resolvePem(input.privateKeyBase64, '商户私钥无效'));
      if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) {
        issues.push('WECHAT_PAY_PRIVATE_KEY:not_rsa2048');
      }
    } catch {
      issues.push('WECHAT_PAY_PRIVATE_KEY:invalid');
    }
  }

  if (input.payPublicKey) {
    try {
      const key = parsePayPublicKey(input.payPublicKey);
      if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) {
        issues.push('WECHAT_PAY_PUBLIC_KEY:not_rsa2048');
      }
    } catch {
      issues.push('WECHAT_PAY_PUBLIC_KEY:invalid');
    }
  }

  return { ready: issues.length === 0, keyMode, issues };
}

export function getWechatPayConfigurationStatus(): WechatPayConfigurationStatus {
  return inspectWechatPayConfiguration(config.wechatPay);
}

export function isWechatPayConfigured(): boolean {
  return getWechatPayConfigurationStatus().ready;
}

function resolvePrivateKeyPem(): string {
  return resolvePem(config.wechatPay.privateKeyBase64, '缺少商户私钥配置 WECHAT_PAY_PRIVATE_KEY');
}

function resolvePayPublicKey() {
  if (!config.wechatPay.payPublicKey) {
    throw new Error('缺少微信支付公钥 WECHAT_PAY_PUBLIC_KEY');
  }
  return parsePayPublicKey(config.wechatPay.payPublicKey);
}

function createNonceStr(): string {
  return randomUUID().replace(/-/g, '').toUpperCase();
}

function buildAuthorizationHeader(method: string, urlPath: string, body: string): string {
  const { mchId, serialNo } = config.wechatPay;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = createNonceStr();
  const message = buildWechatPaySigningMessage(method, urlPath, timestamp, nonceStr, body);
  const signature = createSign('RSA-SHA256').update(message).sign(resolvePrivateKeyPem(), 'base64');

  return (
    `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",`
    + `nonce_str="${nonceStr}",`
    + `signature="${signature}",`
    + `timestamp="${timestamp}",`
    + `serial_no="${serialNo}"`
  );
}

export function buildWechatPaySigningMessage(
  method: string,
  urlPath: string,
  timestamp: string,
  nonceStr: string,
  body: string,
): string {
  return `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
}

export function buildWechatPayResponseSigningMessage(
  timestamp: string,
  nonce: string,
  rawBody: string,
): string {
  return `${timestamp}\n${nonce}\n${rawBody}\n`;
}

export function buildJsapiPaySigningMessage(
  appId: string,
  timeStamp: string,
  nonceStr: string,
  packageValue: string,
): string {
  return `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
}

export function buildWechatPayPlatformHeaders(payPublicKeyId: string): Record<string, string> {
  return getPayKeyMode(payPublicKeyId) !== 'unknown'
    ? { 'Wechatpay-Serial': payPublicKeyId }
    : {};
}

function getHeader(response: AxiosResponse<string>, name: string): string {
  const value = response.headers[name.toLowerCase()];
  return typeof value === 'string' ? value.trim() : '';
}

function parseJsonBody<T>(rawBody: string): T {
  if (!rawBody) return {} as T;
  return JSON.parse(rawBody) as T;
}

async function requestWechatPay<T>(method: 'GET' | 'POST', urlPath: string, body?: Record<string, unknown>): Promise<T> {
  const bodyString = body ? JSON.stringify(body) : '';
  const response = await axios.request<string>({
    method,
    url: `${WECHAT_PAY_BASE_URL}${urlPath}`,
    data: body ? bodyString : undefined,
    headers: {
      Authorization: buildAuthorizationHeader(method, urlPath, bodyString),
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...buildWechatPayPlatformHeaders(config.wechatPay.payPublicKeyId),
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
    const errorBody = parseJsonBody<{ code?: string; message?: string }>(rawBody);
    throw new WechatPayApiError(errorBody.message || '微信支付接口请求失败', {
      code: errorBody.code,
      requestId,
      status: response.status,
    });
  }

  return parseJsonBody<T>(rawBody);
}

export async function jsapiUnifiedOrder(input: UnifiedOrderInput): Promise<string> {
  const { appId, mchId, notifyUrl } = config.wechatPay;
  const requestBody: Record<string, unknown> = {
    appid: appId,
    mchid: mchId,
    description: input.description.slice(0, 127),
    out_trade_no: input.outTradeNo,
    time_expire: input.timeExpire,
    notify_url: notifyUrl,
    amount: { total: input.amountTotal, currency: 'CNY' },
    payer: { openid: input.openid },
  };
  if (input.attach) requestBody.attach = input.attach.slice(0, 127);

  const result = await requestWechatPay<{ prepay_id?: string }>('POST', JSAPI_ORDER_PATH, requestBody);
  if (!result.prepay_id) {
    throw new WechatPayApiError('微信支付统一下单未返回 prepay_id');
  }
  return result.prepay_id;
}

export async function verifyWechatPayConnectivity(): Promise<void> {
  if (!isWechatPayConfigured()) {
    throw new WechatPayApiError('微信支付配置尚未就绪', { status: 503 });
  }
  const echoMessage = `worker-house-${randomUUID()}`;
  const result = await requestWechatPay<{ echo_message?: string }>('POST', SECURITY_ECHO_PATH, {
    echo_message: echoMessage,
  });
  if (result.echo_message !== echoMessage) {
    throw new WechatPayApiError('微信支付安全回显内容不一致');
  }
}

export async function queryWechatPayOrder(outTradeNo: string): Promise<WechatPayOrderResult> {
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.wechatPay.mchId)}`;
  return requestWechatPay<WechatPayOrderResult>('GET', path);
}

export async function closeWechatPayOrder(outTradeNo: string): Promise<void> {
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`;
  await requestWechatPay<Record<string, never>>('POST', path, { mchid: config.wechatPay.mchId });
}

export function buildJsapiPayParams(prepayId: string): JsapiPayParams {
  const { appId } = config.wechatPay;
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = createNonceStr();
  const packageValue = `prepay_id=${prepayId}`;
  const message = buildJsapiPaySigningMessage(appId, timeStamp, nonceStr, packageValue);
  const paySign = createSign('RSA-SHA256').update(message).sign(resolvePrivateKeyPem(), 'base64');

  return { timeStamp, nonceStr, package: packageValue, signType: 'RSA', paySign };
}

export function verifyWechatPaySignature(input: WechatPaySignatureInput): boolean {
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  if (!input.nonce || !input.signature) return false;
  if (input.serialNo !== config.wechatPay.payPublicKeyId) return false;

  try {
    const message = buildWechatPayResponseSigningMessage(input.timestamp, input.nonce, input.rawBody);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(message);
    verifier.end();
    return verifier.verify(resolvePayPublicKey(), input.signature, 'base64');
  } catch (error) {
    console.error('[wechat-pay] signature verification error', error instanceof Error ? error.message : error);
    return false;
  }
}

export function decryptNotifyResource(resource: DecryptedNotifyResource): Record<string, unknown> {
  const { apiV3Key } = config.wechatPay;
  if (resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error('不支持的微信支付回调加密算法');
  }
  if (!apiV3Key || Buffer.byteLength(apiV3Key, 'utf-8') !== 32) {
    throw new Error('WECHAT_PAY_API_KEY_V3 必须是 32 字节');
  }

  const cipherBuffer = Buffer.from(resource.ciphertext, 'base64');
  if (cipherBuffer.length <= 16) throw new Error('微信支付回调密文格式错误');
  const authTag = cipherBuffer.subarray(cipherBuffer.length - 16);
  const encryptedData = cipherBuffer.subarray(0, cipherBuffer.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf-8'), Buffer.from(resource.nonce, 'utf-8'));
  decipher.setAuthTag(authTag);
  if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data, 'utf-8'));

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8')) as Record<string, unknown>;
}

export function createOutTradeNo(openid?: string, clientRequestId?: string, prefix = 'WH'): string {
  const normalizedPrefix = /^[A-Z0-9]{2}$/.test(prefix) ? prefix : 'WH';
  if (openid && clientRequestId) {
    const digest = createHash('sha256')
      .update(`${openid}\u0000${clientRequestId}`, 'utf-8')
      .digest('hex')
      .slice(0, 30)
      .toUpperCase();
    return `${normalizedPrefix}${digest}`;
  }
  const datePart = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${normalizedPrefix}${datePart}${randomUUID().slice(0, 8).toUpperCase()}`;
}
