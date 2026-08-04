import axios from 'axios';
import { config } from './config.js';
import { getWechatAccessToken } from './cloudClient.js';

interface WechatCloudResponse {
  errcode?: number;
  errmsg?: string;
}

interface DatabaseQueryResponse extends WechatCloudResponse {
  data?: unknown[];
  pager?: {
    Limit?: number;
    Offset?: number;
    Total?: number;
  };
}

interface DatabaseAddResponse extends WechatCloudResponse {
  id_list?: string[];
}

interface DatabaseDeleteResponse extends WechatCloudResponse {
  deleted?: number;
}

interface DatabaseUpdateResponse extends WechatCloudResponse {
  matched?: number;
  modified?: number;
}

const DATABASE_BATCH_SIZE = 100;

function ensureSuccessfulResponse<T extends WechatCloudResponse>(payload: T, operation: string) {
  if (payload.errcode && payload.errcode !== 0) {
    throw new Error(`${operation}失败：${payload.errmsg || `errcode=${payload.errcode}`}`);
  }
  return payload;
}

async function callWechatCloudApi<T extends WechatCloudResponse>(
  endpoint: string,
  body: Record<string, unknown>,
  operation: string,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const accessToken = await getWechatAccessToken(attempt > 0);
    const response = await axios.post<T>(
      `https://api.weixin.qq.com/tcb/${endpoint}`,
      {
        env: config.cloudEnvId,
        ...body,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { access_token: accessToken },
        timeout: 15_000,
      },
    );
    if (attempt === 0 && (response.data.errcode === 40001 || response.data.errcode === 42001)) continue;
    return ensureSuccessfulResponse(response.data, operation);
  }
  throw new Error(`${operation}失败：无法刷新微信 access_token`);
}

export function toCloudQueryLiteral(value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('云数据库查询参数不能是 undefined');
  return serialized
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function parseDocument<T extends Record<string, unknown>>(value: unknown): T | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function collectionExpression(collectionName: string) {
  return `db.collection(${toCloudQueryLiteral(collectionName)})`;
}

export async function queryCloudDocuments<T extends Record<string, unknown>>(
  collectionName: string,
  options: {
    orderBy?: { direction: 'asc' | 'desc'; field: string };
    where?: Record<string, unknown>;
  } = {},
) {
  const records: T[] = [];
  let offset = 0;

  while (true) {
    let query = collectionExpression(collectionName);
    if (options.where) query += `.where(${toCloudQueryLiteral(options.where)})`;
    if (options.orderBy) {
      query += `.orderBy(${toCloudQueryLiteral(options.orderBy.field)},${toCloudQueryLiteral(options.orderBy.direction)})`;
    }
    query += `.skip(${offset}).limit(${DATABASE_BATCH_SIZE}).get()`;

    const payload = await callWechatCloudApi<DatabaseQueryResponse>(
      'databasequery',
      { query },
      `查询 ${collectionName}`,
    );
    const page = (payload.data ?? [])
      .map((item) => parseDocument<T>(item))
      .filter((item): item is T => Boolean(item));
    records.push(...page);

    if (page.length < DATABASE_BATCH_SIZE) break;
    offset += page.length;
  }

  return records;
}

export async function getCloudDocument<T extends Record<string, unknown>>(collectionName: string, id: string) {
  const query = `${collectionExpression(collectionName)}.doc(${toCloudQueryLiteral(id)}).get()`;
  const payload = await callWechatCloudApi<DatabaseQueryResponse>(
    'databasequery',
    { query },
    `读取 ${collectionName}`,
  );
  return parseDocument<T>(payload.data?.[0]);
}

export async function addCloudDocument(collectionName: string, data: Record<string, unknown>) {
  const query = `${collectionExpression(collectionName)}.add({data:${toCloudQueryLiteral(data)}})`;
  const payload = await callWechatCloudApi<DatabaseAddResponse>(
    'databaseadd',
    { query },
    `新增 ${collectionName}`,
  );
  const id = payload.id_list?.[0]?.trim();
  if (!id) throw new Error(`新增 ${collectionName} 失败：接口未返回记录 ID`);
  return id;
}

export async function updateCloudDocument(collectionName: string, id: string, data: Record<string, unknown>) {
  const query = `${collectionExpression(collectionName)}.doc(${toCloudQueryLiteral(id)}).update({data:${toCloudQueryLiteral(data)}})`;
  const payload = await callWechatCloudApi<DatabaseUpdateResponse>(
    'databaseupdate',
    { query },
    `更新 ${collectionName}`,
  );
  return Math.max(0, Number(payload.modified ?? payload.matched ?? 0));
}

export async function incrementCloudDocumentFields(
  collectionName: string,
  id: string,
  increments: Record<string, number>,
  values: Record<string, unknown> = {},
) {
  const incrementEntries = Object.entries(increments).map(([field, amount]) => {
    if (!Number.isFinite(amount)) throw new Error(`字段 ${field} 的增量无效`);
    return `${toCloudQueryLiteral(field)}:db.command.inc(${amount})`;
  });
  const valueEntries = Object.entries(values).map(
    ([field, value]) => `${toCloudQueryLiteral(field)}:${toCloudQueryLiteral(value)}`,
  );
  const dataExpression = `{${[...incrementEntries, ...valueEntries].join(',')}}`;
  const query = `${collectionExpression(collectionName)}.doc(${toCloudQueryLiteral(id)}).update({data:${dataExpression}})`;
  const payload = await callWechatCloudApi<DatabaseUpdateResponse>(
    'databaseupdate',
    { query },
    `更新 ${collectionName}`,
  );
  return Math.max(0, Number(payload.modified ?? payload.matched ?? 0));
}

export async function deleteCloudDocument(collectionName: string, id: string) {
  const query = `${collectionExpression(collectionName)}.doc(${toCloudQueryLiteral(id)}).remove()`;
  const payload = await callWechatCloudApi<DatabaseDeleteResponse>(
    'databasedelete',
    { query },
    `删除 ${collectionName}`,
  );
  return Math.max(0, Number(payload.deleted ?? 0));
}

export async function deleteCloudDocumentsWhere(collectionName: string, where: Record<string, unknown>) {
  const query = `${collectionExpression(collectionName)}.where(${toCloudQueryLiteral(where)}).remove()`;
  const payload = await callWechatCloudApi<DatabaseDeleteResponse>(
    'databasedelete',
    { query },
    `批量删除 ${collectionName}`,
  );
  return Math.max(0, Number(payload.deleted ?? 0));
}
