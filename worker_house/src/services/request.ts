import Taro from '@tarojs/taro';
import { cloudrunRequest, type CloudrunRequestOptions } from './cloudrun';

export type ApiMode = 'mock' | 'bff' | 'cloudrun';
export type RequestOptions = CloudrunRequestOptions;

function normalizeApiMode(value?: string): ApiMode {
  if (value === 'bff' || value === 'cloudrun') {
    return value;
  }

  return 'mock';
}

function joinUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function bffRequest<T>(options: RequestOptions): Promise<T> {
  const baseUrl = process.env.TARO_APP_BFF_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('未配置 TARO_APP_BFF_BASE_URL');
  }

  Taro.showNavigationBarLoading();
  try {
    const response = await Taro.request<T>({
      data: options.data,
      header: options.header,
      method: options.method ?? 'GET',
      url: joinUrl(baseUrl, options.path),
    });

    if (response.statusCode >= 400) {
      throw new Error((response.data as any)?.message || '请求失败');
    }

    return response.data as T;
  } finally {
    Taro.hideNavigationBarLoading();
  }
}

export function getApiMode(): ApiMode {
  return normalizeApiMode(process.env.TARO_APP_API_MODE?.trim());
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const apiMode = getApiMode();

  if (apiMode === 'cloudrun') {
    return cloudrunRequest<T>(options);
  }

  if (apiMode === 'bff') {
    return bffRequest<T>(options);
  }

  throw new Error('当前处于 mock 模式，请使用本地 fallback');
}
