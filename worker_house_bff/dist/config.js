import { existsSync } from 'node:fs';
import dotenv from 'dotenv';
if (existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}
dotenv.config();
function readCloudMode(value) {
    if (value === 'wechat' || value === 'cloudrun') {
        return value;
    }
    return 'mock';
}
function readPort(value) {
    const port = Number(value);
    return Number.isFinite(port) && port > 0 ? port : 4000;
}
const cloudMode = readCloudMode(process.env.MODE?.trim() || process.env.CLOUD_MODE?.trim());
export const config = {
    adminToken: process.env.ADMIN_TOKEN?.trim() || 'mock-admin-token',
    cloudAppId: process.env.CLOUD_APP_ID?.trim() || '',
    cloudAppSecret: process.env.CLOUD_APP_SECRET?.trim() || '',
    cloudEnvId: process.env.CLOUD_ENV_ID?.trim() || '',
    cloudMode,
    port: readPort(process.env.PORT),
};
export function assertWechatConfigReady() {
    if (!config.cloudAppId || !config.cloudAppSecret || !config.cloudEnvId) {
        throw new Error('wechat 模式缺少 CLOUD_APP_ID / CLOUD_APP_SECRET / CLOUD_ENV_ID 配置');
    }
}
