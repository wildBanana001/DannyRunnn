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

function getText(value: unknown, maxLength = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
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
  const detail = diagnostic.detail || fallback;
  const location = diagnostic.stage
    ? `阶段:${STAGE_LABELS[diagnostic.stage] || diagnostic.stage}`
    : '';
  const identifiers = [
    diagnostic.code ? `[${diagnostic.code}]` : '',
    location,
    diagnostic.requestId ? `req:${diagnostic.requestId}` : '',
    diagnostic.diagnosticId ? `trace:${diagnostic.diagnosticId}` : '',
  ].filter(Boolean).join(' · ');
  return [`支付失败：${detail}`, identifiers].filter(Boolean).join('\n').slice(0, 500);
}

export function createApiRequestError(statusCode: number, responseData: unknown, fallback: string): ApiRequestError {
  const parsedData = parseResponseData(responseData);
  const payload = getRecord(parsedData);
  const serverMessage = getText(payload?.message) || getText(parsedData);
  const diagnostic = parseDiagnostic(payload?.diagnostic);
  const message = diagnostic
    ? formatDiagnosticMessage(diagnostic, serverMessage || fallback)
    : serverMessage || fallback;

  return new ApiRequestError(message, { diagnostic, responseData: parsedData, statusCode });
}

export function getPaymentErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  const input = getRecord(error);
  const errMsg = getText(input?.errMsg);
  return errMsg || fallback;
}
