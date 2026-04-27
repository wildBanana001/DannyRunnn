import Taro from '@tarojs/taro';
import { cloudEnvId } from './config';

declare const wx: any;

let hasInited = false;

function getCloudApi() {
  const taroCloud = (Taro as typeof Taro & { cloud?: any }).cloud;
  if (taroCloud) {
    return taroCloud;
  }

  return (wx as any)?.cloud;
}

export * from './config';

export function initCloud() {
  if (hasInited || process.env.TARO_ENV !== 'weapp' || !cloudEnvId) {
    return;
  }

  try {
    const cloud = getCloudApi();
    if (cloud?.init) {
      cloud.init({ env: cloudEnvId, traceUser: true });
      hasInited = true;
    }
  } catch (error) {
    console.warn('[cloud] 初始化失败，已回退到本地数据', error);
  }
}

export async function callFn<T = unknown>(name: string, data?: Record<string, unknown>): Promise<T> {
  if (process.env.TARO_ENV !== 'weapp') {
    throw new Error('当前环境不支持微信云开发');
  }

  const cloud = getCloudApi();
  if (!cloud?.callFunction) {
    throw new Error('微信云开发未初始化');
  }

  Taro.showNavigationBarLoading();
  try {
    const result = await cloud.callFunction({ name, data });
    return result.result as T;
  } finally {
    Taro.hideNavigationBarLoading();
  }
}
