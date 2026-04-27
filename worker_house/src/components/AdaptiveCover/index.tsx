import React, { useEffect, useMemo, useState } from 'react';
import { Image, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';

const DEFAULT_RATIO = 4 / 3;
const RATIO_TOLERANCE = 0.1;
const FALLBACK_MIN_HEIGHT = '320rpx';

type CoverDisplayMode = 'fixed' | 'adaptive';

interface AdaptiveCoverProps {
  src: string;
  className?: string;
  imageClassName?: string;
  fallbackMinHeight?: string;
}

const AdaptiveCover: React.FC<AdaptiveCoverProps> = ({
  src,
  className,
  imageClassName,
  fallbackMinHeight = FALLBACK_MIN_HEIGHT
}) => {
  const wrapperId = useMemo(() => `adaptive-cover-${Math.random().toString(36).slice(2, 10)}`, []);
  const [displayMode, setDisplayMode] = useState<CoverDisplayMode>('fixed');
  const [minHeight, setMinHeight] = useState<string>(fallbackMinHeight);

  useEffect(() => {
    let cancelled = false;

    const resolveDisplayMode = async () => {
      if (!src) {
        setDisplayMode('fixed');
        return;
      }

      try {
        const imageInfo = await Taro.getImageInfo({ src });
        if (cancelled) {
          return;
        }

        const ratio = imageInfo.width && imageInfo.height ? imageInfo.width / imageInfo.height : DEFAULT_RATIO;
        const diff = Math.abs(ratio - DEFAULT_RATIO) / DEFAULT_RATIO;
        setDisplayMode(diff <= RATIO_TOLERANCE ? 'fixed' : 'adaptive');
      } catch (error) {
        if (!cancelled) {
          console.warn('[AdaptiveCover] 图片尺寸读取失败，回退为 4:3 展示', error);
          setDisplayMode('fixed');
        }
      }
    };

    resolveDisplayMode();

    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    let cancelled = false;

    const measureWrapper = () => {
      Taro.nextTick(() => {
        Taro.createSelectorQuery()
          .select(`#${wrapperId}`)
          .boundingClientRect((rect) => {
            const nextRect = Array.isArray(rect) ? rect[0] : rect;
            if (!nextRect || cancelled) {
              return;
            }

            if (nextRect.width > 0) {
              setMinHeight(`${nextRect.width * 0.75}px`);
            }
          })
          .exec();
      });
    };

    measureWrapper();

    return () => {
      cancelled = true;
    };
  }, [src, wrapperId]);

  const wrapperStyle = displayMode === 'adaptive' ? { minHeight } : undefined;

  return (
    <View
      id={wrapperId}
      className={classnames(styles.wrapper, className, displayMode === 'adaptive' ? styles.adaptive : undefined)}
      style={wrapperStyle}
    >
      {displayMode === 'adaptive' ? (
        <Image
          className={classnames(styles.image, styles.adaptiveImage, imageClassName)}
          src={src}
          mode="widthFix"
        />
      ) : (
        <View className={styles.fixedFrame}>
          <Image
            className={classnames(styles.image, styles.fixedImage, imageClassName)}
            src={src}
            mode="aspectFill"
          />
        </View>
      )}
    </View>
  );
};

export default AdaptiveCover;
