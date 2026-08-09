import React, { useEffect, useState } from 'react';
import { shopProductPlaceholder } from '@/assets/shop';
import { loadShopProductImage, resolveShopProductImageUrl } from '@/services/shop';
import SafeImage, { type SafeImageProps } from '@/components/SafeImage';

interface ShopProductImageProps extends Omit<SafeImageProps, 'src'> {
  src?: string;
}

const ShopProductImage: React.FC<ShopProductImageProps> = ({
  fallbackSrc = shopProductPlaceholder,
  src = '',
  ...props
}) => {
  const normalizedSrc = src.trim();
  const directlyUsableSrc = resolveShopProductImageUrl(normalizedSrc);
  const [downloadedImage, setDownloadedImage] = useState({ source: '', url: '' });
  const resolvedSrc = directlyUsableSrc
    || (downloadedImage.source === normalizedSrc ? downloadedImage.url : '');

  useEffect(() => {
    if (directlyUsableSrc || !normalizedSrc) return undefined;

    let active = true;

    void loadShopProductImage(normalizedSrc)
      .then((nextSrc) => {
        if (active) setDownloadedImage({ source: normalizedSrc, url: nextSrc });
      })
      .catch((error) => {
        console.warn('[shop] load product image failed', error);
      });

    return () => {
      active = false;
    };
  }, [directlyUsableSrc, normalizedSrc]);

  return <SafeImage {...props} fallbackSrc={fallbackSrc} src={resolvedSrc} />;
};

export default ShopProductImage;
