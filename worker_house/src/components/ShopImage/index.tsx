import React, { useEffect, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import type { CSSProperties } from 'react';
import styles from './index.module.scss';

interface ShopImageProps {
  src: string;
  /** 加载失败时展示的占位文案（通常为商品名首字） */
  fallbackText?: string;
  className?: string;
  style?: CSSProperties;
  /** Image mode，默认 aspectFill */
  mode?: any;
}

/**
 * 商城图片组件：远程图加载失败时降级为涂鸦色块 + 文案占位。
 * 商品图走 BFF 远程目录，图片可能尚未上传，需保证不留白。
 */
const ShopImage: React.FC<ShopImageProps> = ({ src, fallbackText = '好物', className, style, mode = 'aspectFill' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <View className={`${styles.fallback} ${className ?? ''}`} style={style}>
        <Text className={styles.fallbackText}>{fallbackText}</Text>
      </View>
    );
  }

  return (
    <Image
      className={className}
      style={style}
      src={src}
      mode={mode}
      lazyLoad
      // 关闭长按弹原生保存菜单
      show-menu-by-longpress={false}
      onError={() => setFailed(true)}
    />
  );
};

export default ShopImage;
