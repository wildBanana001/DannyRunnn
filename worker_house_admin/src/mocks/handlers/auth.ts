import { http, HttpResponse } from 'msw';

const MOCK_TOKEN = 'mock-token';
const mockUser = {
  id: '1',
  name: '管理员',
  role: 'admin',
};

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const payload = (await request.json()) as { username?: string; password?: string };

    if (payload.username === 'admin' && payload.password === 'admin123') {
      return HttpResponse.json({ token: MOCK_TOKEN, user: mockUser });
    }

    return HttpResponse.json({ message: '账号或密码错误' }, { status: 401 });
  }),
  http.get('/api/auth/profile', ({ request }) => {
    const authorization = request.headers.get('authorization');

    if (authorization !== `Bearer ${MOCK_TOKEN}`) {
      return HttpResponse.json({ message: '未登录或登录已失效' }, { status: 401 });
    }

    return HttpResponse.json({ user: mockUser });
  }),
  http.post('/api/auth/logout', () => HttpResponse.json({ success: true })),
];
