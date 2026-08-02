import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import Taro from '@tarojs/taro';

export interface ViewportLayoutStyle extends CSSProperties {
  '--app-window-height'?: string;
  '--app-header-top'?: string;
  '--app-safe-top'?: string;
  '--app-safe-bottom'?: string;
}

interface UseViewportLayoutOptions {
  /** CSS 中原有的顶部留白，在拿不到胶囊信息的平台继续沿用。 */
  fallbackTopGapRpx?: number;
  /** 微信胶囊底部与页面内容之间的最小间距。 */
  capsuleGapRpx?: number;
  /** H5 的 Taro TabBar 占用 50px，主 Tab 页需要从可滚动高度中扣除。 */
  reserveH5TabBar?: boolean;
}

function readViewportLayout({
  fallbackTopGapRpx = 50,
  capsuleGapRpx = 16,
  reserveH5TabBar = false,
}: UseViewportLayoutOptions): ViewportLayoutStyle {
  let windowInfo: ReturnType<typeof Taro.getWindowInfo> | null = null;

  try {
    windowInfo = Taro.getWindowInfo();
  } catch {
    return {};
  }

  const rawWindowHeight = Number(windowInfo.windowHeight) || 0;
  const h5TabBarHeight = reserveH5TabBar && Taro.getEnv() === Taro.ENV_TYPE.WEB ? 50 : 0;
  const windowHeight = Math.max(0, rawWindowHeight - h5TabBarHeight);
  const screenHeight = Number(windowInfo.screenHeight) || rawWindowHeight;
  const safeAreaTop = Number(windowInfo.safeArea?.top) || 0;
  const safeAreaBottom = Number(windowInfo.safeArea?.bottom) || screenHeight;
  const statusBarHeight = Number(windowInfo.statusBarHeight) || 0;
  const safeTop = Math.max(statusBarHeight, safeAreaTop);
  const safeBottom = Math.max(0, screenHeight - safeAreaBottom);
  let menuBottom = 0;

  if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
    try {
      menuBottom = Number(Taro.getMenuButtonBoundingClientRect().bottom) || 0;
    } catch {
      menuBottom = 0;
    }
  }

  const style: ViewportLayoutStyle = {};

  if (windowHeight > 0) {
    style['--app-window-height'] = `${windowHeight}px`;
  }
  if (safeTop > 0) {
    style['--app-safe-top'] = `${safeTop}px`;
  }
  if (safeBottom > 0) {
    style['--app-safe-bottom'] = `${safeBottom}px`;
  }

  const headerInset = Math.max(safeTop, menuBottom);
  if (headerInset > 0) {
    const gap = menuBottom > 0 ? capsuleGapRpx : fallbackTopGapRpx;
    style['--app-header-top'] = `calc(${headerInset}px + ${gap}rpx)`;
  }

  return style;
}

export function useViewportLayout(options: UseViewportLayoutOptions = {}) {
  const { fallbackTopGapRpx = 50, capsuleGapRpx = 16, reserveH5TabBar = false } = options;
  const resolveStyle = useCallback(
    () => readViewportLayout({ fallbackTopGapRpx, capsuleGapRpx, reserveH5TabBar }),
    [capsuleGapRpx, fallbackTopGapRpx, reserveH5TabBar],
  );
  const [style, setStyle] = useState<ViewportLayoutStyle>(resolveStyle);

  useEffect(() => {
    const updateLayout = () => setStyle(resolveStyle());
    updateLayout();
    Taro.onWindowResize?.(updateLayout);

    return () => {
      Taro.offWindowResize?.(updateLayout);
    };
  }, [resolveStyle]);

  return style;
}

export default useViewportLayout;
