import React from 'react';
import { View } from '@tarojs/components';
import type { ITouchEvent } from '@tarojs/components/types/common';
import type { CSSProperties } from 'react';
import { usePressFeedback } from '@/hooks/usePressFeedback';

/**
 * P0 动效底座：可按压容器
 * 在非标准 Button（如图片按钮 / 自定义 View 按钮）上快速接入
 * 「按压缩放 + 触感」反馈。每个实例持有独立的按压状态。
 */
interface PressableProps {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 按压缩放比例，默认 0.94 */
  scale?: number;
  /** 是否开启触感，默认 true */
  haptic?: boolean;
  disabled?: boolean;
  onClick?: (event: ITouchEvent) => void;
}

const Pressable: React.FC<PressableProps> = ({
  children,
  className,
  style,
  scale,
  haptic,
  disabled = false,
  onClick,
}) => {
  const { bind } = usePressFeedback({ scale, haptic, disabled });

  return (
    <View className={className} {...bind(style)} onClick={disabled ? undefined : onClick}>
      {children}
    </View>
  );
};

export default Pressable;
