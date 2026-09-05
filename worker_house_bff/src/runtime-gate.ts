import { config, hasWechatCloudConfig } from './config.js';
import { isMysqlBackedAdminOrderRequest } from './utils/admin-order-runtime.js';

export interface RuntimeGateContext {
  allowEphemeralCloudrunData: boolean;
  cloudMode: 'mock' | 'wechat' | 'cloudrun';
  enableShop: boolean;
  hasWechatCloudConfig: boolean;
  shopOrderStorage: 'mysql' | 'file';
}

function isCatalogActivityRequest(path: string, method: string) {
  if (path === '/activities') return method === 'GET' || method === 'POST';
  if (!/^\/activities\/[^/]+$/.test(path)) return false;
  return method === 'GET' || method === 'PUT' || method === 'DELETE';
}

function isAdminMiniActivityRequest(path: string, method: string) {
  if (path === '/admin-mini/activities') return method === 'GET' || method === 'POST';
  if (!/^\/admin-mini\/activities\/[^/]+$/.test(path)) return false;
  return method === 'GET' || method === 'PUT' || method === 'DELETE';
}

function isPublicPosterRead(path: string, method: string) {
  return method === 'GET' && (path === '/posters' || /^\/posters\/[^/]+$/.test(path));
}

export function evaluateRuntimeRequest(
  path: string,
  method: string,
  context: RuntimeGateContext,
) {
  if (context.cloudMode !== 'cloudrun' || context.allowEphemeralCloudrunData) return true;

  const normalizedMethod = method.toUpperCase();
  const isAccountPath = path === '/account' || path.startsWith('/account/');
  const accountDeletionReady = isAccountPath
    && (normalizedMethod !== 'DELETE' || context.hasWechatCloudConfig);
  const communityReady = context.hasWechatCloudConfig && (
    path === '/posts'
    || path.startsWith('/posts/')
    || path === '/upload'
    || path.startsWith('/upload/')
    || path === '/admin/upload'
    || path.startsWith('/admin/upload/')
    || path === '/admin-mini/check'
    || path === '/admin-mini/stats'
    || path === '/admin-mini/upload'
    || path === '/admin-mini/posts'
    || path.startsWith('/admin-mini/posts/')
  );
  const posterReadReady = context.hasWechatCloudConfig
    && isPublicPosterRead(path, normalizedMethod);
  const paymentStorageReady = context.shopOrderStorage === 'mysql'
    && (path === '/shop' || path.startsWith('/shop/'));
  const paymentAdminOrderReady = context.enableShop
    && context.shopOrderStorage === 'mysql'
    && isMysqlBackedAdminOrderRequest(path, normalizedMethod);
  const mysqlCatalogReady = context.shopOrderStorage === 'mysql'
    && (
      isCatalogActivityRequest(path, normalizedMethod)
      || isAdminMiniActivityRequest(path, normalizedMethod)
    );
  const bundledSiteConfigRead = normalizedMethod === 'GET' && path === '/site-config';

  return accountDeletionReady
    || communityReady
    || posterReadReady
    || paymentStorageReady
    || paymentAdminOrderReady
    || mysqlCatalogReady
    || bundledSiteConfigRead;
}

export function isRequestRuntimeReady(path: string, method: string) {
  return evaluateRuntimeRequest(path, method, {
    allowEphemeralCloudrunData: config.allowEphemeralCloudrunData,
    cloudMode: config.cloudMode,
    enableShop: config.enableShop,
    hasWechatCloudConfig: hasWechatCloudConfig(),
    shopOrderStorage: config.shopOrderStorage,
  });
}
