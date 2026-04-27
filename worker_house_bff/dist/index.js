import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { getSiteConfig as getCommunitySiteConfig } from './data/siteConfig.js';
import { activityRouter } from './routes/activity.js';
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
import { siteRouter } from './routes/site.js';
import { storiesRouter, adminMiniStoriesRouter } from './routes/stories.js';
import { adminUploadRouter, userUploadRouter } from './routes/upload.js';
const app = express();
function buildHealthPayload() {
    return {
        mode: config.cloudMode,
        status: 'ok',
        timestamp: Date.now(),
    };
}
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static('public'));
app.get('/health', (_request, response) => {
    response.json(buildHealthPayload());
});
app.get('/api/health', (_request, response) => {
    response.json(buildHealthPayload());
});
app.get('/api/site-config', (_request, response) => {
    response.json(getCommunitySiteConfig());
});
app.use('/api/auth', authRouter);
app.use('/api/auth', authWxRouter);
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
app.use((error, _request, response, _next) => {
    const message = error instanceof Error ? error.message : '服务内部错误';
    response.status(500).json({ message });
});
app.listen(config.port, () => {
    console.log(`worker_house_bff 已启动：http://localhost:${config.port} （mode=${config.cloudMode}）`);
});
