import cors from 'cors';
import express from 'express';
import { config, hasWechatCloudConfig } from './config.js';
import { initializeActivityCatalog } from './data/activities.js';
import { getSiteConfig as getCommunitySiteConfig } from './data/siteConfig.js';
import { checkOrderStorageReady } from './data/orders.js';
import { initializeShopCatalog } from './data/shop.js';
import { activityRouter } from './routes/activity.js';
import { accountRouter } from './routes/account.js';
import { adminMiniRouter } from './routes/adminMini.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { authWxRouter } from './routes/authWx.js';
import { cardOrderRouter } from './routes/cardOrder.js';
import { cardPackageRouter } from './routes/cardPackage.js';
import { postRouter } from './routes/post.js';
import { posterRouter } from './routes/poster.js';
import { profileRouter } from './routes/profile.js';
import { addressRouter } from './routes/addresses.js';
import { registrationRouter } from './routes/registration.js';
import { shopRouter } from './routes/shop.js';
import { siteRouter } from './routes/site.js';
import { storiesRouter, adminMiniStoriesRouter } from './routes/stories.js';
import { adminUploadRouter, userUploadRouter } from './routes/upload.js';
import { isRequestRuntimeReady } from './runtime-gate.js';
import { getWechatPayConfigurationStatus } from './utils/wechat-pay.js';

const app = express();

function isRuntimeReady() {
  return config.cloudMode !== 'cloudrun' || config.allowEphemeralCloudrunData;
}

function buildHealthPayload() {
  const paymentConfiguration = getWechatPayConfigurationStatus();
  return {
    mode: config.cloudMode,
    community: {
      storage: hasWechatCloudConfig() ? 'cloudbase' : 'configuration_required',
      wallEnabled: config.enableCommunityWall,
    },
    persistence: config.cloudMode === 'cloudrun'
      ? config.shopOrderStorage === 'mysql'
        ? 'mysql-orders+catalogs'
        : 'ephemeral-filesystem'
      : 'local-filesystem',
    shop: {
      enabled: config.enableShop,
      payment: config.cloudMode === 'mock'
        ? 'mock'
        : paymentConfiguration.ready
          ? 'ready'
          : 'configuration_required',
      keyMode: paymentConfiguration.keyMode,
      orderStorage: config.shopOrderStorage,
    },
    status: isRuntimeReady() ? 'ok' : 'configuration_required',
    timestamp: Date.now(),
  };
}

app.use(cors());
app.use(express.json({
  limit: '12mb',
  verify: (request, _response, buffer) => {
    (request as express.Request).rawBody = buffer.toString('utf-8');
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static('public'));

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    timestamp: Date.now(),
  });
});

app.get('/api/health', (_request, response) => {
  response.status(isRuntimeReady() ? 200 : 503).json(buildHealthPayload());
});

app.use('/api', (request, response, next) => {
  if (!isRequestRuntimeReady(request.path, request.method)) {
    response.status(503).json({
      message: '该接口仍依赖未迁移的临时存储，云托管生产环境暂未开放；订单与活动/商品目录已使用 MySQL',
    });
    return;
  }
  next();
});

app.get('/api/site-config', (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({
    ...getCommunitySiteConfig(),
    communityWallEnabled: config.enableCommunityWall,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/auth', authWxRouter);
app.use('/api/account', accountRouter);
app.use('/api/posters', posterRouter);
app.use('/api/activities', activityRouter);
app.use('/api/profiles', profileRouter);
app.use('/api/addresses', addressRouter);
app.use('/api/registrations', registrationRouter);
app.use('/api/card-orders', cardOrderRouter);
app.use('/api/card-packages', cardPackageRouter);
app.use('/api/admin/upload', adminUploadRouter);
app.use('/api/upload', userUploadRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/admin-mini/stories', adminMiniStoriesRouter);
app.use('/api/admin-mini', adminMiniRouter);
app.use('/api/admin', adminRouter);
app.use('/api/posts', postRouter);
app.use('/api/site', siteRouter);
// Keep payment notifications and existing-order queries available even when
// new sales are paused. The route-level gate only blocks pay/retry endpoints.
app.use('/api/shop', shopRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error('[http] unhandled error', error instanceof Error ? error.message : error);
  response.status(500).json({ message: '服务内部错误' });
});

async function startServer() {
  await Promise.all([
    initializeActivityCatalog(),
    initializeShopCatalog(),
  ]);

  app.listen(config.port, () => {
    console.log(`worker_house_bff 已启动：http://localhost:${config.port} （mode=${config.cloudMode}）`);
    if (config.enableShop && config.cloudMode !== 'mock') {
      void checkOrderStorageReady().then((ready) => {
        if (!ready) console.warn('[orders store] configuration_required');
      });
      const paymentConfiguration = getWechatPayConfigurationStatus();
      if (!paymentConfiguration.ready) {
        console.warn(`[wechat-pay] configuration_required issues=${paymentConfiguration.issues.join(',')}`);
      }
    }
  });
}

void startServer().catch((error) => {
  console.error('[startup] catalog initialization failed', error instanceof Error ? error.message : error);
  process.exit(1);
});
