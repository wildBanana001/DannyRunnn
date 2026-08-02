import Taro from '@tarojs/taro';

declare const wx: any;

export interface CloudrunRequestOptions {
  data?: any;
  header?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
}

function getCloudApi() {
  const taroCloud = (Taro as typeof Taro & { cloud?: any }).cloud;
  if (taroCloud?.callContainer) {
    return taroCloud;
  }

  const wechatCloud = (wx as any)?.cloud;
  if (wechatCloud?.callContainer) {
    return wechatCloud;
  }

  throw new Error('微信云托管未初始化');
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function getResponseErrorMessage(response: any) {
  const statusCode = Number(response?.statusCode) || 0;
  const data = response?.data;
  const serverMessage = typeof data?.message === 'string'
    ? data.message.trim()
    : typeof data === 'string' && data.length <= 120 && !data.trimStart().startsWith('<')
      ? data.trim()
      : '';
  if (serverMessage) return serverMessage;
  if (statusCode === 404) return '支付服务版本尚未更新，请稍后重试';
  if (statusCode === 503) return '支付服务尚未就绪，请稍后重试';
  return statusCode ? `云托管请求失败（${statusCode}）` : '云托管请求失败';
}

export async function cloudrunRequest<T>(options: CloudrunRequestOptions): Promise<T> {
  if (process.env.TARO_ENV !== 'weapp') {
    throw new Error('当前环境不支持微信云托管调用');
  }

  const env = process.env.TARO_APP_CLOUDRUN_ENV?.trim();
  if (!env) {
    throw new Error('未配置 TARO_APP_CLOUDRUN_ENV');
  }

  const service = process.env.TARO_APP_CLOUDRUN_SERVICE?.trim();
  const cloud = getCloudApi();

  Taro.showNavigationBarLoading();
  try {
    const response = await cloud.callContainer({
      config: { env },
      data: options.data,
      header: {
        ...(service ? { 'X-WX-SERVICE': service } : {}),
        ...(options.header ?? {}),
      },
      method: options.method ?? 'GET',
      path: normalizePath(options.path),
    });

    if ((response as any).statusCode >= 400) {
      throw new Error(getResponseErrorMessage(response));
    }

    return (response as any).data as T;
  } finally {
    Taro.hideNavigationBarLoading();
  }
}
