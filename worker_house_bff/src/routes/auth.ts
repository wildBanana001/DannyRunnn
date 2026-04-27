import { Router } from 'express';
import { destroyAdminSession, getAdminSession, loginAdmin } from '../cloudClient.js';
import { authMiddleware, resolveRequestToken } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (request, response) => {
  const username = String(request.body?.username ?? '').trim();
  const password = String(request.body?.password ?? '');

  if (!username || !password) {
    response.status(400).json({ message: '账号密码不能为空' });
    return;
  }

  try {
    const result = await loginAdmin(username, password);
    if (!result.success) {
      response.status(400).json({ message: result.error });
      return;
    }

    response.json(result.data);
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : '登录失败' });
  }
});

authRouter.get('/profile', authMiddleware, (request, response) => {
  const token = resolveRequestToken(request);
  const session = getAdminSession(token);

  if (!session) {
    response.status(401).json({ message: '登录状态已失效，请重新登录' });
    return;
  }

  response.json({ user: session.user });
});

authRouter.post('/logout', authMiddleware, (request, response) => {
  destroyAdminSession(resolveRequestToken(request));
  response.json({ success: true });
});
