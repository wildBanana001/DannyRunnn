import type { Request } from 'express';
import { Router } from 'express';
import { isOpenidAdmin } from '../config/adminWhitelist.js';
import { getUserByOpenid, upsertUser } from '../data/users.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';

export const authWxRouter = Router();

function resolveWxOpenid(request: Request) {
  return request.wxUser?.openid?.trim() || '';
}

authWxRouter.use(wxCloudrunAuth);

authWxRouter.post('/wx-login', (request, response) => {
  const openid = resolveWxOpenid(request);

  if (!openid) {
    response.status(401).json({ message: '缺少微信身份信息' });
    return;
  }

  const { user, isNew } = upsertUser(openid, {});

  response.json({
    openid: user.openid,
    nickname: user.nickname,
    avatar: user.avatar,
    isAdmin: isOpenidAdmin(openid),
    isNew,
  });
});

authWxRouter.post('/wx-profile', (request, response) => {
  const openid = resolveWxOpenid(request);

  if (!openid) {
    response.status(401).json({ message: '缺少微信身份信息' });
    return;
  }

  const nickname = String(request.body?.nickname ?? '').trim();
  const avatar = String(request.body?.avatar ?? '').trim();

  if (!nickname || !avatar) {
    response.status(400).json({ message: '昵称和头像不能为空' });
    return;
  }

  const { user } = upsertUser(openid, { nickname, avatar });
  response.json(user);
});

authWxRouter.get('/wx-me', (request, response) => {
  const openid = resolveWxOpenid(request);

  if (!openid) {
    response.status(401).json({ message: '缺少微信身份信息' });
    return;
  }

  const user = getUserByOpenid(openid);
  if (!user) {
    response.status(404).json({ message: '用户不存在' });
    return;
  }

  response.json(user);
});
