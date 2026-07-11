import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * P0 动效底座：页面 / 区块入场动效
 * 挂载后渐入 + 上移（默认 24rpx），使用顺滑缓动。
 * 只动 transform / opacity，不触发重排。
 *
 * 用法：
 *   const { style } = useEnterAnimation();
 *   <View style={style}>...</View>
 */
interface UseEnterAnimationOptions {
  /** 入场上移距离（rpx），默认 24 */
  offset?: number;
  /** 动画时长（ms），默认 300 */
  duration?: number;
  /** 延迟触发（ms），默认 0，可用于错峰入场 */
  delay?: number;
  /** 是否启用，默认 true */
  enabled?: boolean;
}

export function useEnterAnimation(options: UseEnterAnimationOptions = {}) {
  const { offset = 24, duration = 300, delay = 0, enabled = true } = options;
  const [entered, setEntered] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    // 下一帧再切到完成态，确保初始态先渲染，触发过渡
    const timer = setTimeout(() => setEntered(true), delay + 16);
    return () => clearTimeout(timer);
  }, [enabled, delay]);

  const style: CSSProperties = {
    opacity: entered ? 1 : 0,
    transform: entered ? 'translate3d(0, 0, 0)' : `translate3d(0, ${offset}rpx, 0)`,
    transition: `opacity ${duration}ms var(--anim-ease-smooth, cubic-bezier(0.4, 0, 0.2, 1)), transform ${duration}ms var(--anim-ease-smooth, cubic-bezier(0.4, 0, 0.2, 1))`,
    willChange: 'opacity, transform',
  };

  return { entered, style };
}

export default useEnterAnimation;
