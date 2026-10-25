import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';

test('admin HTTP flow requires whitelist, imports without publishing, and persists create/edit/unpublish', async () => {
  process.env.NODE_ENV = 'test';
  process.env.MODE = 'mock';
  process.env.SHOP_ORDER_STORAGE = 'file';
  process.env.ADMIN_OPENID_WHITELIST = 'allowed-admin';
  const directory = mkdtempSync(path.join(tmpdir(), 'worker-house-admin-test-'));
  const storePath = path.join(directory, 'activities.json');
  copyFileSync(fileURLToPath(new URL('../data/activities.store.json', import.meta.url)), storePath);
  process.env.ACTIVITY_CATALOG_FILE = storePath;
  const { adminMiniRouter } = await import('./adminMini.js');
  const { activityRouter } = await import('./activity.js');
  const { evaluateRuntimeRequest } = await import('../runtime-gate.js');
  // Mock transport supplies test identities; enforce the real whitelist policy.
  process.env.NODE_ENV = 'production';
  const app = express();
  app.use(express.json());
  app.use('/api', (request, response, next) => {
    if (!evaluateRuntimeRequest(request.path, request.method, {
      cloudMode: 'cloudrun', allowEphemeralCloudrunData: false, hasWechatCloudConfig: false,
      enableShop: false, shopOrderStorage: 'mysql',
    })) { response.sendStatus(503); return; }
    next();
  });
  app.use('/api/admin-mini', adminMiniRouter);
  app.use('/api/activities', activityRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (route: string, method = 'GET', body?: unknown, openid = 'allowed-admin') => fetch(`${base}/api${route}`, {
    method, headers: { 'content-type': 'application/json', 'x-wx-openid': openid },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    const identity = await call('/admin-mini/check', 'POST');
    assert.equal(identity.status, 200);
    assert.equal((await identity.json() as { isAdmin: boolean }).isAdmin, true);
    assert.equal((await call('/admin-mini/activities', 'GET', undefined, 'not-admin')).status, 401);
    assert.equal((await call('/admin-mini/activities/import', 'POST', { type: 'text', content: '没有权限的用户不能导入推文' }, 'not-admin')).status, 401);
    const before = await (await call('/admin-mini/activities')).json() as { total: number };
    assert.equal((await call('/admin-mini/activities/import', 'POST', { type: 'url', content: 'https://mp.weixin.qq.com/s/example' })).status, 422, 'only copied body text is supported');
    const imported = await call('/admin-mini/activities/import', 'POST', { type: 'text', content: '新活动\n欢迎周末一起参加手作交流活动\n活动时间：2099年11月08日 14:00-16:00\n地点：社畜之家\n费用：88元\n人数：20人' });
    assert.equal(imported.status, 200);
    const { draft } = await imported.json() as { draft: Record<string, unknown> };
    const after = await (await call('/admin-mini/activities')).json() as { total: number };
    assert.equal(after.total, before.total, 'generating a draft has no catalog side effect');
    assert.equal((await call('/admin-mini/activities', 'POST', { ...draft, enabled: true })).status, 422, 'incomplete imported content cannot be published');
    const createdResponse = await call('/admin-mini/activities', 'POST', {
      ...draft, coverImage: 'https://example.com/cover.jpg', gallery: [], enabled: false,
      originalPrice: 88, currentParticipants: 0, cardEligible: false,
    });
    assert.equal(createdResponse.status, 200);
    const created = await createdResponse.json() as { id: string };
    assert.equal((await call(`/activities/${created.id}`)).status, 404, 'unpublished activities stay private');
    assert.equal((await call(`/admin-mini/activities/${created.id}`, 'PUT', { enabled: true }, 'not-admin')).status, 401);
    assert.equal((await call(`/admin-mini/activities/${created.id}`, 'PUT', { enabled: true, title: '已核对的活动' })).status, 200);
    const published = await call(`/activities/${created.id}`);
    assert.equal(published.status, 200);
    assert.equal((await published.json() as { title: string }).title, '已核对的活动');
    assert.equal((await call(`/admin-mini/activities/${created.id}`, 'PUT', { enabled: false })).status, 200);
    assert.equal((await call(`/activities/${created.id}`)).status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
    process.env.NODE_ENV = 'test';
  }
});
