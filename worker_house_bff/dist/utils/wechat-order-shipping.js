import axios from 'axios';
import { config } from '../config.js';
const ACCESS_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
const UPLOAD_SHIPPING_URL = 'https://api.weixin.qq.com/wxa/sec/order/upload_shipping_info';
const TOKEN_REFRESH_ERROR_CODES = new Set([40001, 40014, 42001]);
const IDEMPOTENT_SUCCESS_ERROR_CODES = new Set([10060002, 10060023]);
const RETRIABLE_ERROR_CODES = new Set([-1, 10060012, 10060019]);
let accessTokenCache = null;
let accessTokenRequest = null;
export class WechatOrderShippingApiError extends Error {
    code;
    retriable;
    constructor(code, message, retriable = false) {
        super(message);
        this.name = 'WechatOrderShippingApiError';
        this.code = code;
        this.retriable = retriable;
    }
}
export function getWechatOrderShippingConfigurationStatus() {
    const issues = [
        !config.cloudAppId ? 'CLOUD_APP_ID' : '',
        !config.cloudAppSecret ? 'CLOUD_APP_SECRET' : '',
        !config.wechatPay.mchId ? 'WECHAT_PAY_MCH_ID' : '',
    ].filter(Boolean);
    if (config.wechatPay.appId && config.cloudAppId && config.wechatPay.appId !== config.cloudAppId) {
        issues.push('CLOUD_APP_ID/WECHAT_APP_ID:mismatch');
    }
    return { ready: issues.length === 0, issues };
}
function assertWechatOrderShippingConfigured() {
    const { issues } = getWechatOrderShippingConfigurationStatus();
    if (issues.length > 0) {
        throw new WechatOrderShippingApiError('CONFIGURATION_REQUIRED', `微信订单履约上报配置不完整：${issues.join('、')}`);
    }
}
export function truncateUtf8(value, maxBytes) {
    let result = '';
    for (const character of value) {
        if (Buffer.byteLength(result + character, 'utf8') > maxBytes)
            break;
        result += character;
    }
    return result;
}
export function buildWechatSelfPickupShippingPayload(order, uploadTime = new Date().toISOString(), mchId = config.wechatPay.mchId) {
    const itemDescription = `${order.productName || '到店商品'} x${Math.max(1, order.quantity)}`;
    return {
        order_key: {
            order_number_type: 1,
            mchid: mchId,
            out_trade_no: order.id,
        },
        logistics_type: 4,
        delivery_mode: 1,
        shipping_list: [{ item_desc: truncateUtf8(itemDescription, 120) }],
        upload_time: uploadTime,
        payer: { openid: order.openid },
    };
}
async function fetchAccessToken(forceRefresh = false) {
    if (!forceRefresh && accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
        return accessTokenCache.token;
    }
    if (!forceRefresh && accessTokenRequest)
        return accessTokenRequest;
    assertWechatOrderShippingConfigured();
    const request = (async () => {
        const response = await axios.get(ACCESS_TOKEN_URL, {
            params: {
                appid: config.cloudAppId,
                grant_type: 'client_credential',
                secret: config.cloudAppSecret,
            },
            timeout: 10_000,
        });
        if (!response.data.access_token) {
            throw new WechatOrderShippingApiError(response.data.errcode ?? 'ACCESS_TOKEN_FAILED', response.data.errmsg || '获取微信 access_token 失败');
        }
        accessTokenCache = {
            token: response.data.access_token,
            expiresAt: Date.now() + Math.max((response.data.expires_in ?? 7_200) - 300, 60) * 1_000,
        };
        return response.data.access_token;
    })();
    accessTokenRequest = request;
    try {
        return await request;
    }
    finally {
        if (accessTokenRequest === request)
            accessTokenRequest = null;
    }
}
async function postShippingInfo(payload, forceRefreshToken = false) {
    const accessToken = await fetchAccessToken(forceRefreshToken);
    const response = await axios.post(UPLOAD_SHIPPING_URL, payload, {
        params: { access_token: accessToken },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
    });
    return response.data;
}
function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
export async function uploadWechatSelfPickupShippingInfo(order) {
    assertWechatOrderShippingConfigured();
    const payload = buildWechatSelfPickupShippingPayload(order);
    let refreshedToken = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        let result;
        try {
            result = await postShippingInfo(payload, refreshedToken);
        }
        catch (error) {
            if (error instanceof WechatOrderShippingApiError)
                throw error;
            if (attempt < 2 && axios.isAxiosError(error)) {
                await wait((attempt + 1) * 200);
                continue;
            }
            throw new WechatOrderShippingApiError('NETWORK_ERROR', '微信订单履约接口网络请求失败', true);
        }
        const errorCode = Number(result.errcode ?? 0);
        if (errorCode === 0 || IDEMPOTENT_SUCCESS_ERROR_CODES.has(errorCode))
            return;
        if (!refreshedToken && TOKEN_REFRESH_ERROR_CODES.has(errorCode)) {
            accessTokenCache = null;
            refreshedToken = true;
            continue;
        }
        if (attempt < 2 && RETRIABLE_ERROR_CODES.has(errorCode)) {
            await wait((attempt + 1) * 200);
            continue;
        }
        throw new WechatOrderShippingApiError(errorCode, result.errmsg || `微信订单履约上报失败（${errorCode}）`, RETRIABLE_ERROR_CODES.has(errorCode));
    }
    throw new WechatOrderShippingApiError('RETRY_EXHAUSTED', '微信订单履约上报重试次数已用尽', true);
}
