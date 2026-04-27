import type { Request, Response } from 'express';

export function parsePage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function paginate<T>(list: T[], page: number, pageSize: number) {
  const startIndex = (page - 1) * pageSize;
  return {
    list: list.slice(startIndex, startIndex + pageSize),
    total: list.length,
  };
}

export function resolveWxOpenid(request: Request) {
  return request.wxUser?.openid?.trim() || request.header('x-wx-openid')?.trim() || '';
}

export function requireWxOpenid(request: Request, response: Response) {
  const openid = resolveWxOpenid(request);
  if (!openid) {
    response.status(401).json({ message: '缺少微信身份信息' });
    return null;
  }
  return openid;
}
