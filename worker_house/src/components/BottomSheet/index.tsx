import React, { useEffect, useState } from 'react';
import { View } from '@tarojs/components';
import type { ITouchEvent } from '@tarojs/components/types/common';
import classnames from 'classnames';
import styles from './index.module.scss';

interface BottomSheetProps {
  visible: boolean;
  state: 'opening' | 'closing';
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  height?: string;
  dragCloseThreshold?: number;
}

const DEFAULT_CLOSE_DISTANCE = 150;
const HIDDEN_TRANSFORM = 'translateY(calc(100% + 24rpx))';

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  state,
  onClose,
  children,
  footer,
  className,
  bodyClassName,
  height = '70vh',
  dragCloseThreshold = DEFAULT_CLOSE_DISTANCE
}) => {
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (visible || state === 'opening') {
      setDragOffset(0);
      setDragStartY(null);
    }
  }, [state, visible]);

  const handleTouchStart = (event: ITouchEvent) => {
    if (!visible) {
      return;
    }

    const nextY = event.touches?.[0]?.pageY;
    setDragStartY(typeof nextY === 'number' ? nextY : null);
  };

  const handleTouchMove = (event: ITouchEvent) => {
    if (!visible || dragStartY === null) {
      return;
    }

    const currentY = event.touches?.[0]?.pageY ?? dragStartY;
    setDragOffset(Math.max(0, currentY - dragStartY));
  };

  const handleTouchEnd = () => {
    if (!visible) {
      return;
    }

    if (dragOffset >= dragCloseThreshold) {
      onClose();
      return;
    }

    setDragOffset(0);
    setDragStartY(null);
  };

  const sheetTransform = !visible
    ? HIDDEN_TRANSFORM
    : state === 'closing'
      ? HIDDEN_TRANSFORM
      : `translateY(${dragOffset}px)`;

  return (
    <View
      catchMove
      className={classnames(
        styles.overlay,
        visible ? (state === 'closing' ? styles.overlayClosing : styles.overlayVisible) : styles.overlayHidden
      )}
      onClick={visible ? onClose : undefined}
    >
      <View
        catchMove
        className={styles.sheet}
        style={{ height, transform: sheetTransform }}
        onClick={(event) => event.stopPropagation()}
      >
        <View className={classnames(styles.panel, className)}>
          <View className={styles.dragArea} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <View className={styles.dragBar} />
          </View>
          <View className={classnames(styles.body, bodyClassName)}>{children}</View>
          {footer}
        </View>
      </View>
    </View>
  );
};

export default BottomSheet;
