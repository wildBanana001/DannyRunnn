export interface ApiDiagnosticPayload {
  code?: string;
  detail?: string;
  diagnosticId?: string;
  operation?: string;
  requestId?: string;
  source?: string;
  stage?: string;
  status?: number;
}

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly diagnostic: ApiDiagnosticPayload | null;
  readonly responseData: unknown;

  constructor(message: string, options: {
    diagnostic?: ApiDiagnosticPayload | null;
    responseData?: unknown;
    statusCode?: number;
  } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = options.statusCode || 0;
    this.diagnostic = options.diagnostic || null;
    this.responseData = options.responseData;
  }
}

const STAGE_LABELS: Record<string, string> = {
  request_validation: '请求校验',
  order_lookup: '订单库查询',
  order_create: '订单库写入',
  order_settle: '订单结算',
  payment_preparation: '微信统一下单',
  payment_params: '支付参数签名',
  payment_retry: '支付重试',
};

function parseResponseData(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  const text = data.trim();
  if (!text || !text.startsWith('{')) return data;
  try {
    return JSON.parse(text);
  } catch {
    return data;
  }
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function getText(value: unknown, maxLength = 4000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

const LEGACY_CLOUDBASE_PATTERN = /credentials?\s+missing|missing\s+credentials?|cloudbase/i;
const LEGACY_CLOUDBASE_DETAIL = [
  '当前请求仍命中了依赖 CloudBase 的旧版 BFF。',
  '请确认 main 最新版本已经在微信云托管部署并切换到 100% 流量；新版订单库使用云托管 MySQL，不再需要 CLOUDBASE_APIKEY。',
  '失败位置：订单库查询，当前尚未调用微信支付。',
].join('\n');

function isLegacyCloudBaseFailure(code: string, detail: string): boolean {
  return code.startsWith('CLOUDBASE_') || LEGACY_CLOUDBASE_PATTERN.test(detail);
}

function normalizeStandaloneMessage(message: string): string {
  if (!LEGACY_CLOUDBASE_PATTERN.test(message)) return message;
  return [
    `支付失败：${LEGACY_CLOUDBASE_DETAIL}`,
    `[LEGACY_CLOUDBASE_BFF] · 阶段:${STAGE_LABELS.order_lookup}`,
    `原始错误：${message}`,
  ].join('\n');
}

function parseDiagnostic(value: unknown): ApiDiagnosticPayload | null {
  const input = getRecord(value);
  if (!input) return null;
  return {
    code: getText(input.code, 80),
    detail: getText(input.detail),
    diagnosticId: getText(input.diagnosticId, 80),
    operation: getText(input.operation, 80),
    requestId: getText(input.requestId, 100),
    source: getText(input.source, 40),
    stage: getText(input.stage, 80),
    status: Number(input.status) || 0,
  };
}

function formatDiagnosticMessage(diagnostic: ApiDiagnosticPayload, fallback: string): string {
  const rawDetail = diagnostic.detail || fallback;
  const legacyCloudBase = isLegacyCloudBaseFailure(diagnostic.code || '', rawDetail);
  const detail = legacyCloudBase ? LEGACY_CLOUDBASE_DETAIL : rawDetail;
  const code = legacyCloudBase ? 'LEGACY_CLOUDBASE_BFF' : diagnostic.code;
  const location = diagnostic.stage
    ? `阶段:${STAGE_LABELS[diagnostic.stage] || diagnostic.stage}`
    : '';
  const identifiers = [
    code ? `[${code}]` : '',
    location,
    diagnostic.requestId ? `req:${diagnostic.requestId}` : '',
    diagnostic.diagnosticId ? `trace:${diagnostic.diagnosticId}` : '',
  ].filter(Boolean).join(' · ');
  const original = legacyCloudBase && rawDetail !== detail ? `原始错误：${rawDetail}` : '';
  return [`支付失败：${detail}`, identifiers, original].filter(Boolean).join('\n');
}

export function createApiRequestError(statusCode: number, responseData: unknown, fallback: string): ApiRequestError {
  const parsedData = parseResponseData(responseData);
  const payload = getRecord(parsedData);
  const serverMessage = getText(payload?.message) || getText(parsedData);
  const diagnostic = parseDiagnostic(payload?.diagnostic);
  const message = diagnostic
    ? formatDiagnosticMessage(diagnostic, serverMessage || fallback)
    : normalizeStandaloneMessage(serverMessage || fallback);

  return new ApiRequestError(message, { diagnostic, responseData: parsedData, statusCode });
}

export function getPaymentErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError && error.diagnostic) {
    return formatDiagnosticMessage(error.diagnostic, error.message.trim() || fallback);
  }
  if (error instanceof Error && error.message.trim()) return normalizeStandaloneMessage(error.message.trim());
  const input = getRecord(error);
  const errMsg = getText(input?.errMsg);
  return normalizeStandaloneMessage(errMsg || fallback);
}
