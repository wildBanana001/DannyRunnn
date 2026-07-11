import { useCallback, useState } from 'react';
import Taro from '@tarojs/taro';
import type { CSSProperties } from 'react';

/**
 * P0 动效底座：按钮按压反馈
 * - 按下：缩放到 scale（默认 0.94）+ 轻微触感（vibrateShort）
 * - 松开 / 取消：回弹到 1，使用弹性缓动
 * 只动 transform，不触发重排。
 *
 * 用法：
 *   const { bind } = usePressFeedback();
 *   <View {...bind()} onClick={...} />
 *   // 需要保留原有内联样式时：<View {...bind({ marginTop: '10rpx' })} />
 */
interface UsePressFeedbackOptions {
  /** 按压缩放比例，默认 0.94 */
  scale?: number;
  /** 是否开启触感反馈，默认 true */
  haptic?: boolean;
  /** 触感强度，默认 light */
  hapticType?: 'heavy' | 'medium' | 'light';
  /** 禁用态：不缩放、不震动 */
  disabled?: boolean;
}

interface PressableProps {
  style: CSSProperties;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export function usePressFeedback(options: UsePressFeedbackOptions = {}) {
  const { scale = 0.94, haptic = true, hapticType = 'light', disabled = false } = options;
  const [pressed, setPressed] = useState(false);

  const handleTouchStart = useCallback(() => {
    if (disabled) {
      return;
    }
    setPressed(true);
    if (haptic) {
      // 触感失败（真机不支持 / 用户关闭）时静默降级
      Taro.vibrateShort({ type: hapticType }).catch(() => {});
    }
  }, [disabled, haptic, hapticType]);

  const handleTouchEnd = useCallback(() => {
    setPressed(false);
  }, []);

  const bind = useCallback(
    (baseStyle?: CSSProperties): PressableProps => ({
      style: {
        ...baseStyle,
        transform: pressed && !disabled ? `scale(${scale})` : 'scale(1)',
        transition: 'transform var(--anim-duration-feedback, 150ms) var(--anim-ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1))',
        willChange: 'transform',
      },
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    }),
    [pressed, disabled, scale, handleTouchStart, handleTouchEnd]
  );

  return { pressed, bind };
}

export default usePressFeedback;
