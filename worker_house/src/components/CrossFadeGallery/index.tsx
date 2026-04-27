import React, { useEffect, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';

export interface CrossFadeSlide {
  image: string;
  title: string;
}

interface CrossFadeGalleryProps {
  className?: string;
  slides: CrossFadeSlide[];
  interval?: number;
}

const CrossFadeGallery: React.FC<CrossFadeGalleryProps> = ({ className, slides, interval = 3000 }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, slides.length]);

  return (
    <View className={classnames(styles.container, className)}>
      {slides.map((slide, index) => (
        <View key={`${slide.image}-${slide.title}`} className={classnames(styles.slide, index === activeIndex && styles.slideActive)}>
          <Image className={styles.image} src={slide.image} mode="aspectFill" />
          <View className={styles.labelWrap}>
            <Text className={styles.label}>{slide.title}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

export default CrossFadeGallery;
