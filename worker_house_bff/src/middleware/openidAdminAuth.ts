import type { NextFunction, Request, Response } from 'express';
import { isOpenidAdmin } from '../config/adminWhitelist.js';

declare module 'express-serve-static-core' {
  interface Request {
    adminOpenid?: string;
  }
}

export function resolveAdminOpenid(request: Request) {
  return request.header('x-wx-openid')?.trim() || '';
}

export function openidAdminAuth(request: Request, response: Response, next: NextFunction) {
  const openid = resolveAdminOpenid(request);

  if (!openid) {
    response.status(401).json({ message: '缺少微信身份信息' });
    return;
  }

  if (!isOpenidAdmin(openid)) {
    response.status(401).json({ message: '你不是管理员', openid });
    return;
  }

  request.adminOpenid = openid;
  next();
}
