import { randomUUID } from 'node:crypto';
import { WechatPayApiError } from './wechat-pay.js';

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
  source: 'bff' | 'cloudbase' | 'wechat-pay';
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
    .replace(/\b(authorization|api[_-]?key|secret(?:id|key)?|token|private[_-]?key|openid)\s*[:=]\s*["']?[^"',;\s]+/gi, '$1=[REDACTED]')
    .replace(/\b[A-Za-z0-9+/_=-]{64,}\b/g, '[REDACTED_VALUE]')
    .replace(/https?:\/\/[^\s?]+\?[^\s]+/g, (url) => `${url.split('?')[0]}?[REDACTED_QUERY]`)
    .replace(/\s+/g, ' ')
    .trim();
  return (sanitized || fallback).slice(0, 240);
}

function normalizeCode(value: string, detail: string): string {
  const explicit = value.trim();
  if (explicit && !/^error$/i.test(explicit)) {
    return explicit.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80).toUpperCase();
  }
  if (/fetch failed|network|ECONN|ENOTFOUND|ETIMEDOUT/i.test(detail)) return 'NETWORK_FETCH_FAILED';
  if (/collection|database|cloudbase|数据库|集合/i.test(detail)) return 'CLOUDBASE_STORAGE_ERROR';
  if (/private key|私钥/i.test(detail)) return 'PRIVATE_KEY_INVALID';
  if (/signature|验签|签名/i.test(detail)) return 'SIGNATURE_ERROR';
  if (/config|配置/i.test(detail)) return 'PAYMENT_CONFIGURATION_ERROR';
  return 'PAYMENT_ORDER_ERROR';
}

function inferSource(error: unknown, stage: PaymentFailureStage, code: string, detail: string): PaymentFailureDiagnostic['source'] {
  if (error instanceof WechatPayApiError) return 'wechat-pay';
  if (stage === 'order_lookup' || stage === 'order_create' || stage === 'order_settle') return 'cloudbase';
  if (/cloudbase|database|collection|数据库|集合/i.test(`${code} ${detail}`)) return 'cloudbase';
  return 'bff';
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
  const detail = sanitizeDiagnosticText(rawDetail, options.fallbackMessage);
  const rawCode = error instanceof WechatPayApiError
    ? error.code
    : firstString(records, ['code', 'errCode', 'errcode', 'name']);
  const code = normalizeCode(rawCode, detail);
  const requestId = sanitizeDiagnosticText(
    error instanceof WechatPayApiError
      ? error.requestId
      : firstString(records, ['requestId', 'request_id', 'traceId', 'trace_id']),
    '',
  );
  const upstreamStatus = error instanceof WechatPayApiError && error.status >= 400 && error.status <= 599
    ? error.status
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
    status: error instanceof WechatPayApiError ? 502 : 500,
    payload: {
      message: `${options.fallbackMessage} [${diagnostic.code}] ${diagnostic.detail}（${metadata}）`,
      diagnostic,
    },
  };
}
