import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import { resolve } from 'node:path';
import { isProductionWeappBuild, resolveBuildApiMode } from './api-mode';
import devConfig from './dev';
import prodConfig from './prod';

const defineEnv = (name: string, fallback = '') => JSON.stringify(process.env[name] ?? fallback);
// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  const apiMode = resolveBuildApiMode(process.env.TARO_APP_API_MODE, {
    isProductionWeapp: isProductionWeappBuild(process.env.TARO_ENV, process.env.NODE_ENV),
  });
  const cloudEnvId = process.env.TARO_APP_CLOUD_ENV_ID?.trim() || '';
  const cloudrunService = process.env.TARO_APP_CLOUDRUN_SERVICE?.trim() || '';
  if (apiMode === 'cloudrun' && (!cloudEnvId || !cloudrunService)) {
    throw new Error(
      'CloudRun 构建必须配置 TARO_APP_CLOUD_ENV_ID 和 TARO_APP_CLOUDRUN_SERVICE',
    );
  }
  const remoteSafeDataAliases = apiMode === 'mock'
      ? {}
      : {
        '@/data/activities$': resolve(__dirname, '../src/data/remote-safe/activities.ts'),
        '@/data/mock-member$': resolve(__dirname, '../src/data/remote-safe/mock-member.ts'),
        '@/data/posts$': resolve(__dirname, '../src/data/remote-safe/posts.ts'),
        '@/data/posters$': resolve(__dirname, '../src/data/remote-safe/posters.ts'),
      };
  // Resolve `@` directly through Webpack. A path-resolution plugin runs before
  // aliases and would otherwise send these exact imports back to the local mock
  // modules, silently shipping business seeds in production.
  const sourceAliases = {
    ...remoteSafeDataAliases,
    '@': resolve(__dirname, '../src'),
  };
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'taro_template',
    date: '2025-12-10',
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: process.env.TARO_OUTPUT_DIR || 'dist',
    plugins: ['@tarojs/plugin-html'],
    defineConstants: {
      'process.env.TARO_APP_API_MODE': JSON.stringify(apiMode),
      'process.env.TARO_APP_BFF_BASE_URL': defineEnv('TARO_APP_BFF_BASE_URL'),
      'process.env.TARO_APP_CLOUD_ENV_ID': JSON.stringify(cloudEnvId),
      'process.env.TARO_APP_CLOUDRUN_SERVICE': JSON.stringify(cloudrunService),
      'process.env.TARO_APP_FONT_ASSET_BASE_URL': defineEnv('TARO_APP_FONT_ASSET_BASE_URL'),
      'process.env.TARO_APP_SHOP_ASSET_BASE_URL': defineEnv('TARO_APP_SHOP_ASSET_BASE_URL'),
    },
    copy: {
      patterns: [],
      options: {},
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        enable: false,
      },
    },
    cache: {
      enable: false, // Webpack 持久化缓存配置，建议开启。默认配置请参考：https://docs.taro.zone/docs/config-detail#cache
    },
    mini: {
      optimizeMainPackage: {
        enable: true,
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: ['nut-'],
          },
        },
        cssModules: {
          enable: true, // 开启 CSS Modules
          config: {
            namingPattern: 'module', // 仅 *.module.scss 生效
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
      webpackChain(chain) {
        chain.resolve.alias.merge(sourceAliases);
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js',
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: true, // 开启 CSS Modules
          config: {
            namingPattern: 'module', // 仅 *.module.scss 生效
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: ['body'],
            baseFontSize: 37.5,
            unitPrecision: 5,
          },
        },
      },
      webpackChain(chain) {
        chain.resolve.alias.merge(sourceAliases);
      },
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: true,
        },
      },
    },
  };
  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig);
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig);
});
