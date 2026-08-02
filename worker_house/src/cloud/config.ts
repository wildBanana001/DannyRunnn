import { CLOUD_ENV_ID, CLOUDRUN_SERVICE } from '../constants/runtime';

const trimEnv = (value?: string) => value?.trim() ?? '';

const normalizeBaseUrl = (value?: string) => {
  const nextValue = trimEnv(value);
  return nextValue ? nextValue.replace(/\/$/, '') : '';
};

export const cloudEnvId = CLOUD_ENV_ID;

export const cloudrunService = CLOUDRUN_SERVICE;

export const fontAssetBaseUrl = normalizeBaseUrl(process.env.TARO_APP_FONT_ASSET_BASE_URL)
  || normalizeBaseUrl(process.env.TARO_APP_BFF_BASE_URL);

export function getPublicAssetUrl(path: string) {
  if (!fontAssetBaseUrl) {
    return '';
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${fontAssetBaseUrl}${normalizedPath}`;
}
