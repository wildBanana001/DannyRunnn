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

const cloudMode = readCloudMode(process.env.MODE?.trim() || process.env.CLOUD_MODE?.trim());

export const config = {
  adminToken: process.env.ADMIN_TOKEN?.trim() || 'mock-admin-token',
  cloudAppId: process.env.CLOUD_APP_ID?.trim() || '',
  cloudAppSecret: process.env.CLOUD_APP_SECRET?.trim() || '',
  cloudEnvId: process.env.CLOUD_ENV_ID?.trim() || '',
  cloudMode,
  port: readPort(process.env.PORT),
  wechatPay: {
    // 小程序 AppID（固定），默认取项目 AppID。
    appId: process.env.WECHAT_APP_ID?.trim() || 'wx06f0bff0bed0dc80',
    // 商户号。
    mchId: process.env.WECHAT_PAY_MCH_ID?.trim() || '',
    // 商户证书序列号。
    serialNo: process.env.WECHAT_PAY_SERIAL_NO?.trim() || '',
    // 商户私钥（PEM），支持 base64 编码存储。
    privateKeyBase64: process.env.WECHAT_PAY_PRIVATE_KEY?.trim() || '',
    // APIv3 密钥（用于回调解密）。
    apiV3Key: process.env.WECHAT_PAY_API_KEY_V3?.trim() || '',
    // 支付结果异步通知地址。
    notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL?.trim() || '',
  },
} as const;

export function assertWechatConfigReady() {
  if (!config.cloudAppId || !config.cloudAppSecret || !config.cloudEnvId) {
    throw new Error('wechat 模式缺少 CLOUD_APP_ID / CLOUD_APP_SECRET / CLOUD_ENV_ID 配置');
  }
}
