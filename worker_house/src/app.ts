import React, { useEffect } from 'react';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { getPublicAssetUrl, initCloud } from '@/cloud';
import { useUserStore } from '@/store/userStore';
import './app.scss';

const DISPLAY_FONT_PATH = '/static/fonts/honglei-zhuoshu.woff2';
let hasLoadedDisplayFont = false;

async function loadDisplayFontFace() {
  if (process.env.TARO_ENV !== 'weapp' || hasLoadedDisplayFont || typeof Taro.loadFontFace !== 'function') {
    return;
  }

  const sourceUrl = getPublicAssetUrl(DISPLAY_FONT_PATH);
  if (!sourceUrl) {
    return;
  }

  hasLoadedDisplayFont = true;

  try {
    await Taro.loadFontFace({
      family: 'HongleiZhuoShu',
      source: `url("${sourceUrl}")`,
      global: true,
      scopes: ['webview', 'native'],
      success: () => console.log('[font] loaded'),
      fail: (error) => console.warn('[font] fail', error),
    } as Parameters<typeof Taro.loadFontFace>[0]);
  } catch (error) {
    console.warn('[font] fail', error);
  }
}

function App(props: { children?: React.ReactNode }) {
  const bootstrapFromCache = useUserStore((state) => state.bootstrapFromCache);

  useEffect(() => {
    initCloud();
    void loadDisplayFontFace();
    bootstrapFromCache();
  }, [bootstrapFromCache]);

  useDidShow(() => {});
  useDidHide(() => {});

  return props.children;
}

export default App;
