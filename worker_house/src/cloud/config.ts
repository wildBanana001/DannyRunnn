const trimEnv = (value?: string) => value?.trim() ?? '';

const normalizeBaseUrl = (value?: string) => {
  const nextValue = trimEnv(value);
  return nextValue ? nextValue.replace(/\/$/, '') : '';
};

export const cloudEnvId = trimEnv(process.env.TARO_APP_CLOUD_ENV)
  || trimEnv(process.env.TARO_APP_CLOUDRUN_ENV)
  || 'prod-d9g991lo4dba5a4da';

export const cloudrunService = trimEnv(process.env.TARO_APP_CLOUDRUN_SERVICE);

export const fontAssetBaseUrl = normalizeBaseUrl(process.env.TARO_APP_FONT_ASSET_BASE_URL)
  || normalizeBaseUrl(process.env.TARO_APP_BFF_BASE_URL);

export function getPublicAssetUrl(path: string) {
  if (!fontAssetBaseUrl) {
    return '';
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${fontAssetBaseUrl}${normalizedPath}`;
}
