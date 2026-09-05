export type BuildApiMode = 'mock' | 'bff' | 'cloudrun';

const SUPPORTED_API_MODES = new Set<BuildApiMode>(['mock', 'bff', 'cloudrun']);

interface ResolveBuildApiModeOptions {
  isProductionWeapp: boolean;
}

export function resolveBuildApiMode(
  value: string | undefined,
  { isProductionWeapp }: ResolveBuildApiModeOptions,
): BuildApiMode {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    if (isProductionWeapp) {
      throw new Error(
        '正式微信小程序构建必须显式设置 TARO_APP_API_MODE=cloudrun 或 TARO_APP_API_MODE=bff',
      );
    }
    return 'mock';
  }

  if (!SUPPORTED_API_MODES.has(normalizedValue as BuildApiMode)) {
    throw new Error(
      `不支持的 TARO_APP_API_MODE=${normalizedValue}，可选值为 mock / bff / cloudrun`,
    );
  }

  if (isProductionWeapp && normalizedValue === 'mock') {
    throw new Error('正式微信小程序构建禁止使用 TARO_APP_API_MODE=mock');
  }

  return normalizedValue as BuildApiMode;
}

export function isProductionWeappBuild(
  taroEnv: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  return taroEnv === 'weapp' && nodeEnv === 'production';
}
