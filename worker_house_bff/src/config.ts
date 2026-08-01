import { existsSync } from 'node:fs';
import dotenv from 'dotenv';

if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

dotenv.config();

export type CloudMode = 'mock' | 'wechat' | 'cloudrun';

function readCloudMode(value?: string): CloudMode {
  if (value === 'wechat' || value === 'cloudrun') {
    return value;
  }

  return 'mock';
}

function readPort(value?: string) {
  const port = Number(value);
  return Number.isFinite(port) && port > 0 ? port : 4000;
}

function readBoolean(value?: string) {
  return value?.trim().toLowerCase() === 'true';
}

const cloudMode = readCloudMode(process.env.MODE?.trim() || process.env.CLOUD_MODE?.trim());
const isProduction = process.env.NODE_ENV === 'production';
const enableShopValue = process.env.ENABLE_SHOP?.trim();

export const config = {
  adminToken: process.env.ADMIN_TOKEN?.trim() || (!isProduction && cloudMode === 'mock' ? 'mock-admin-token' : ''),
  allowEphemeralCloudrunData: readBoolean(process.env.ALLOW_EPHEMERAL_CLOUDRUN_DATA),
  cloudAppId: process.env.CLOUD_APP_ID?.trim() || '',
  cloudAppSecret: process.env.CLOUD_APP_SECRET?.trim() || '',
  cloudEnvId: process.env.CLOUD_ENV_ID?.trim() || '',
  cloudMode,
  enableShop: enableShopValue ? readBoolean(enableShopValue) : cloudMode === 'mock',
  port: readPort(process.env.PORT),
  wechatPay: {
    appId: process.env.WECHAT_APP_ID?.trim() || process.env.CLOUD_APP_ID?.trim() || '',
    mchId: process.env.WECHAT_PAY_MCH_ID?.trim() || '',
    serialNo: process.env.WECHAT_PAY_SERIAL_NO?.trim() || '',
    privateKeyBase64: process.env.WECHAT_PAY_PRIVATE_KEY?.trim() || '',
    apiV3Key: process.env.WECHAT_PAY_API_KEY_V3?.trim() || '',
    notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL?.trim() || '',
    payPublicKey: process.env.WECHAT_PAY_PUBLIC_KEY?.trim() || process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY?.trim() || '',
    payPublicKeyId: process.env.WECHAT_PAY_PUBLIC_KEY_ID?.trim() || process.env.WECHAT_PAY_PLATFORM_SERIAL_NO?.trim() || '',
  },
} as const;

export function hasWechatCloudConfig() {
  return Boolean(config.cloudAppId && config.cloudAppSecret && config.cloudEnvId);
}

export function assertWechatConfigReady() {
  if (!hasWechatCloudConfig()) {
    throw new Error('wechat 模式缺少 CLOUD_APP_ID / CLOUD_APP_SECRET / CLOUD_ENV_ID 配置');
  }
}
