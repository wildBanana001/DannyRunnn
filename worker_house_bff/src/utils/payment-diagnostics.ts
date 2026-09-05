import { randomUUID } from 'node:crypto';
import { WechatPayApiError } from './wechat-pay.js';

const STORAGE_UNAVAILABLE_CODES = new Set([
  'ACTIVITY_CATALOG_STORAGE_INVALID',
  'MYSQL_CONFIGURATION_REQUIRED',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_NO_SUCH_TABLE',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  'NETWORK_FETCH_FAILED',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
]);

export type PaymentFailureStage =
  | 'request_validation'
  | 'order_lookup'
  | 'order_create'
  | 'order_settle'
  | 'payment_preparation'
  | 'payment_params'
  | 'payment_retry';

export interface PaymentFailureDiagnostic {
  code: string;
  detail: string;
  diagnosticId: string;
  operation: string;
  requestId: string;
  source: 'bff' | 'mysql' | 'wechat-pay';
  stage: PaymentFailureStage;
  status: number;
}

export interface PaymentFailureResponse {
  status: number;
  payload: {
    message: string;
    diagnostic: PaymentFailureDiagnostic;
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function collectErrorRecords(error: unknown): Record<string, unknown>[] {
  const root = asRecord(error);
  if (!root) return [];
  const cause = asRecord(root.cause);
  const response = asRecord(root.response);
  const responseData = asRecord(response?.data);
  return [root, cause, responseData, response].filter((value): value is Record<string, unknown> => Boolean(value));
}

function firstString(records: Record<string, unknown>[], keys: string[]): string {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }
  return '';
}

function sanitizeDiagnosticText(value: string, fallback: string): string {
  const sanitized = (value || fallback)
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[REDACTED_PEM]')
    .replace(/\bmysql:\/\/[^\s"'`]+/gi, 'mysql://[REDACTED_CONNECTION]')
    .replace(/\b(authorization|api[_-]?key|secret(?:id|key)?|token|private[_-]?key|openid)\s*[:=]\s*["']?[^"',;\s]+/gi, '$1=[REDACTED]')
    .replace(/\b[A-Za-z0-9+/_=-]{64,}\b/g, '[REDACTED_VALUE]')
    .replace(/https?:\/\/[^\s?]+\?[^\s]+/g, (url) => `${url.split('?')[0]}?[REDACTED_QUERY]`)
    .replace(/\s+/g, ' ')
    .trim();
  return (sanitized || fallback).slice(0, 1_200);
}

function normalizeCode(value: string, detail: string): string {
  const explicit = value.trim();
  if (explicit && !/^error$/i.test(explicit)) {
    return explicit.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80).toUpperCase();
  }
  if (/MySQL 订单库配置不完整|MYSQL_(ADDRESS|USERNAME|PASSWORD|DATABASE)/i.test(detail)) {
    return 'MYSQL_CONFIGURATION_REQUIRED';
  }
  if (/ER_NO_SUCH_TABLE|doesn't exist|table.*not found/i.test(detail)) return 'ER_NO_SUCH_TABLE';
  if (/ER_BAD_DB_ERROR|unknown database/i.test(detail)) return 'ER_BAD_DB_ERROR';
  if (/ER_ACCESS_DENIED_ERROR|access denied/i.test(detail)) return 'ER_ACCESS_DENIED_ERROR';
  if (/fetch failed|network|ECONN|ENOTFOUND|ETIMEDOUT/i.test(detail)) return 'NETWORK_FETCH_FAILED';
  if (/mysql|database|数据库/i.test(detail)) return 'MYSQL_STORAGE_ERROR';
  if (/private key|私钥/i.test(detail)) return 'PRIVATE_KEY_INVALID';
  if (/signature|验签|签名/i.test(detail)) return 'SIGNATURE_ERROR';
  if (/config|配置/i.test(detail)) return 'PAYMENT_CONFIGURATION_ERROR';
  return 'PAYMENT_ORDER_ERROR';
}

function normalizeDetail(code: string, detail: string): string {
  if (code === 'MYSQL_CONFIGURATION_REQUIRED') return '微信云托管 MySQL 配置不完整。请配置 MYSQL_ADDRESS、MYSQL_USERNAME、MYSQL_PASSWORD、MYSQL_DATABASE。';
  if (code === 'ER_ACCESS_DENIED_ERROR') return 'MySQL 用户名或密码无效，请核对云托管 MySQL 连接信息。';
  if (code === 'ER_BAD_DB_ERROR') return 'MySQL 数据库不存在，请先在微信云托管的 MySQL 页面创建数据库，并核对 MYSQL_DATABASE。';
  if (code === 'ER_NO_SUCH_TABLE') return 'MySQL 订单表尚未初始化，请保持 MYSQL_AUTO_MIGRATE=true 后重新部署，或执行 npm run migrate:orders。';
  if (['ECONNRESET', 'EPIPE', 'PROTOCOL_CONNECTION_LOST'].includes(code)) {
    return 'MySQL 订单库连接被临时中断，请稍后重试；如持续出现，请检查云托管 MySQL 状态和内网连接配置。';
  }
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'NETWORK_FETCH_FAILED', 'PROTOCOL_SEQUENCE_TIMEOUT'].includes(code)) {
    return 'BFF 无法连接微信云托管 MySQL，请核对内网地址、端口与网络环境。';
  }
  return detail;
}

function inferSource(error: unknown, stage: PaymentFailureStage, code: string, detail: string): PaymentFailureDiagnostic['source'] {
  if (error instanceof WechatPayApiError) return 'wechat-pay';
  if (stage === 'order_lookup' || stage === 'order_create' || stage === 'order_settle') return 'mysql';
  if (/mysql|database|数据库|^ER_|ECONN|ENOTFOUND|ETIMEDOUT/i.test(`${code} ${detail}`)) return 'mysql';
  return 'bff';
}

function isStorageUnavailable(code: string) {
  return STORAGE_UNAVAILABLE_CODES.has(code);
}

export function buildPaymentFailureResponse(
  error: unknown,
  options: {
    fallbackMessage: string;
    operation: string;
    stage: PaymentFailureStage;
  },
): PaymentFailureResponse {
  const records = collectErrorRecords(error);
  const rawDetail = error instanceof Error
    ? error.message
    : firstString(records, ['message', 'errMsg', 'errmsg', 'error']) || String(error || '');
  const sanitizedDetail = sanitizeDiagnosticText(rawDetail, options.fallbackMessage);
  const rawCode = error instanceof WechatPayApiError
    ? error.code
    : firstString(records, ['code', 'errCode', 'errcode', 'name']);
  const code = normalizeCode(rawCode, sanitizedDetail);
  const detail = normalizeDetail(code, sanitizedDetail);
  const requestId = sanitizeDiagnosticText(
    error instanceof WechatPayApiError
      ? error.requestId
      : firstString(records, ['requestId', 'request_id', 'traceId', 'trace_id']),
    '',
  );
  const upstreamStatus = error instanceof WechatPayApiError && error.status >= 400 && error.status <= 599
    ? error.status
    : isStorageUnavailable(code)
      ? 503
      : 500;
  const diagnostic: PaymentFailureDiagnostic = {
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
    status: error instanceof WechatPayApiError
      ? 502
      : isStorageUnavailable(code)
        ? 503
        : 500,
    payload: {
      message: `${options.fallbackMessage} [${diagnostic.code}] ${diagnostic.detail}（${metadata}）`,
      diagnostic,
    },
  };
}
