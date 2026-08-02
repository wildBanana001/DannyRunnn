import { randomUUID } from 'node:crypto';
import { WechatPayApiError } from './wechat-pay.js';
function asRecord(value) {
    return value && typeof value === 'object' ? value : null;
}
function collectErrorRecords(error) {
    const root = asRecord(error);
    if (!root)
        return [];
    const cause = asRecord(root.cause);
    const response = asRecord(root.response);
    const responseData = asRecord(response?.data);
    return [root, cause, responseData, response].filter((value) => Boolean(value));
}
function firstString(records, keys) {
    for (const record of records) {
        for (const key of keys) {
            const value = record[key];
            if (typeof value === 'string' && value.trim())
                return value.trim();
            if (typeof value === 'number' && Number.isFinite(value))
                return String(value);
        }
    }
    return '';
}
function sanitizeDiagnosticText(value, fallback) {
    const sanitized = (value || fallback)
        .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[REDACTED_PEM]')
        .replace(/\b(authorization|api[_-]?key|secret(?:id|key)?|token|private[_-]?key|openid)\s*[:=]\s*["']?[^"',;\s]+/gi, '$1=[REDACTED]')
        .replace(/\b[A-Za-z0-9+/_=-]{64,}\b/g, '[REDACTED_VALUE]')
        .replace(/https?:\/\/[^\s?]+\?[^\s]+/g, (url) => `${url.split('?')[0]}?[REDACTED_QUERY]`)
        .replace(/\s+/g, ' ')
        .trim();
    return (sanitized || fallback).slice(0, 240);
}
function normalizeCode(value, detail) {
    const explicit = value.trim();
    if (explicit && !/^error$/i.test(explicit)) {
        return explicit.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80).toUpperCase();
    }
    if (/fetch failed|network|ECONN|ENOTFOUND|ETIMEDOUT/i.test(detail))
        return 'NETWORK_FETCH_FAILED';
    if (/collection|database|cloudbase|数据库|集合/i.test(detail))
        return 'CLOUDBASE_STORAGE_ERROR';
    if (/private key|私钥/i.test(detail))
        return 'PRIVATE_KEY_INVALID';
    if (/signature|验签|签名/i.test(detail))
        return 'SIGNATURE_ERROR';
    if (/config|配置/i.test(detail))
        return 'PAYMENT_CONFIGURATION_ERROR';
    return 'PAYMENT_ORDER_ERROR';
}
function inferSource(error, stage, code, detail) {
    if (error instanceof WechatPayApiError)
        return 'wechat-pay';
    if (stage === 'order_lookup' || stage === 'order_create' || stage === 'order_settle')
        return 'cloudbase';
    if (/cloudbase|database|collection|数据库|集合/i.test(`${code} ${detail}`))
        return 'cloudbase';
    return 'bff';
}
export function buildPaymentFailureResponse(error, options) {
    const records = collectErrorRecords(error);
    const rawDetail = error instanceof Error
        ? error.message
        : firstString(records, ['message', 'errMsg', 'errmsg', 'error']) || String(error || '');
    const detail = sanitizeDiagnosticText(rawDetail, options.fallbackMessage);
    const rawCode = error instanceof WechatPayApiError
        ? error.code
        : firstString(records, ['code', 'errCode', 'errcode', 'name']);
    const code = normalizeCode(rawCode, detail);
    const requestId = sanitizeDiagnosticText(error instanceof WechatPayApiError
        ? error.requestId
        : firstString(records, ['requestId', 'request_id', 'traceId', 'trace_id']), '');
    const upstreamStatus = error instanceof WechatPayApiError && error.status >= 400 && error.status <= 599
        ? error.status
        : 500;
    const diagnostic = {
        code,
        detail,
        diagnosticId: `PAY-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
        operation: options.operation,
        requestId,
        source: inferSource(error, options.stage, code, detail),
        stage: options.stage,
        status: upstreamStatus,
    };
    const metadata = [
        `stage=${diagnostic.stage}`,
        diagnostic.requestId ? `request-id=${diagnostic.requestId}` : '',
        `trace=${diagnostic.diagnosticId}`,
    ].filter(Boolean).join('；');
    return {
        status: error instanceof WechatPayApiError ? 502 : 500,
        payload: {
            message: `${options.fallbackMessage} [${diagnostic.code}] ${diagnostic.detail}（${metadata}）`,
            diagnostic,
        },
    };
}
