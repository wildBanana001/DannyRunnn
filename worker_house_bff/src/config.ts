import { existsSync } from 'node:fs';
import dotenv from 'dotenv';

if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

dotenv.config();

export type CloudMode = 'mock' | 'wechat' | 'cloudrun';
export type ShopOrderStorage = 'mysql' | 'file';

const isProduction = process.env.NODE_ENV === 'production';

function readCloudMode(value?: string): CloudMode {
  if (value === 'wechat' || value === 'cloudrun') {
    return value;
  }

  if (isProduction) {
    throw new Error('生产环境必须显式配置 MODE=cloudrun 或 MODE=wechat，禁止回退到 mock');
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

function readShopOrderStorage(value: string | undefined, cloudMode: CloudMode): ShopOrderStorage {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'mysql') return 'mysql';
  if (normalized === 'file') return 'file';
  if (normalized === 'cloudbase') {
    throw new Error('SHOP_ORDER_STORAGE=cloudbase 已停用；请先完成历史订单迁移，再显式改为 mysql');
  }
  if (normalized) throw new Error(`不支持的 SHOP_ORDER_STORAGE=${normalized}`);
  return cloudMode === 'cloudrun' ? 'mysql' : 'file';
}

function readBoundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function readMysqlAddress(value?: string) {
  const address = value?.trim() || '';
  if (!address) return { host: '', port: undefined as number | undefined };

  const ipv6 = address.match(/^\[([^\]]+)](?::(\d+))?$/);
  if (ipv6) {
    return {
      host: ipv6[1],
      port: ipv6[2] ? readBoundedInteger(ipv6[2], 3306, 1, 65_535) : undefined,
    };
  }

  const hostAndPort = address.match(/^([^:]+):(\d+)$/);
  if (hostAndPort) {
    return {
      host: hostAndPort[1],
      port: readBoundedInteger(hostAndPort[2], 3306, 1, 65_535),
    };
  }

  return { host: address, port: undefined as number | undefined };
}

const cloudMode = readCloudMode(process.env.MODE?.trim() || process.env.CLOUD_MODE?.trim());
const enableShopValue = process.env.ENABLE_SHOP?.trim();
const mysqlAddress = readMysqlAddress(process.env.MYSQL_ADDRESS);

export const config = {
  adminToken: process.env.ADMIN_TOKEN?.trim() || (!isProduction && cloudMode === 'mock' ? 'mock-admin-token' : ''),
  allowEphemeralCloudrunData: readBoolean(process.env.ALLOW_EPHEMERAL_CLOUDRUN_DATA),
  cloudAppId: process.env.CLOUD_APP_ID?.trim() || '',
  cloudAppSecret: process.env.CLOUD_APP_SECRET?.trim() || '',
  cloudAdminServiceToken: process.env.CLOUD_ADMIN_SERVICE_TOKEN?.trim() || '',
  cloudEnvId: process.env.CLOUD_ENV_ID?.trim() || '',
  cloudMode,
  enableShop: enableShopValue ? readBoolean(enableShopValue) : cloudMode === 'mock',
  mysql: {
    autoMigrate: readBoolean(process.env.MYSQL_AUTO_MIGRATE),
    connectionLimit: readBoundedInteger(process.env.MYSQL_CONNECTION_LIMIT, 5, 1, 10),
    connectTimeoutMs: readBoundedInteger(process.env.MYSQL_CONNECT_TIMEOUT_MS, 10_000, 1_000, 30_000),
    database: process.env.MYSQL_DATABASE?.trim() || process.env.DB_NAME?.trim() || 'worker_house',
    host: mysqlAddress.host || process.env.DB_HOST?.trim() || '',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
    port: mysqlAddress.port
      || readBoundedInteger(process.env.DB_PORT, 3306, 1, 65_535),
    url: process.env.MYSQL_URL?.trim() || process.env.CONNECTION_URI?.trim() || '',
    username: process.env.MYSQL_USERNAME?.trim() || process.env.DB_USER?.trim() || '',
  },
  port: readPort(process.env.PORT),
  shopOrderStorage: readShopOrderStorage(process.env.SHOP_ORDER_STORAGE, cloudMode),
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
