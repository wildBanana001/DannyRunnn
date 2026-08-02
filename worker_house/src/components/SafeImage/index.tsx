import React, { useEffect, useRef, useState } from 'react';
import { Image, type ImageProps } from '@tarojs/components';
import defaultFallback from '@/assets/home/hero-cover.jpg';

interface SafeImageProps extends Omit<ImageProps, 'src' | 'onError'> {
  src?: string;
  fallbackSrc?: string;
  fallbackDelayMs?: number;
  onError?: ImageProps['onError'];
}

const SafeImage: React.FC<SafeImageProps> = ({
  src,
  fallbackSrc = defaultFallback,
  fallbackDelayMs = 0,
  onError,
  onLoad,
  ...props
}) => {
  const preferredSrc = src?.trim() || fallbackSrc;
  const [resolvedSrc, setResolvedSrc] = useState(preferredSrc);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    setResolvedSrc(preferredSrc);

    if (fallbackDelayMs > 0 && preferredSrc !== fallbackSrc) {
      fallbackTimerRef.current = setTimeout(() => setResolvedSrc(fallbackSrc), fallbackDelayMs);
    }

    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [fallbackDelayMs, fallbackSrc, preferredSrc]);

  return (
    <Image
      {...props}
      src={resolvedSrc}
      onLoad={(event) => {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        onLoad?.(event);
      }}
      onError={(event) => {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        if (resolvedSrc !== fallbackSrc) {
          setResolvedSrc(fallbackSrc);
        }
        onError?.(event);
      }}
    />
  );
};

export default SafeImage;
