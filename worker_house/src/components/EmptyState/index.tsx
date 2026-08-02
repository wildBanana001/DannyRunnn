import React from 'react';
import { Image, Text, View } from '@tarojs/components';
import emptyIllustration from '@/assets/illustrations/envelope.png';
import styles from './index.module.scss';

interface EmptyStateProps {
  title: string;
  description?: string;
  image?: string;
  children?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description = '暂无内容，先去逛逛别的页面吧。',
  image = emptyIllustration,
  children,
}) => {
  return (
    <View className={styles.container}>
      <Image className={styles.image} src={image} mode="aspectFit" />
      <Text className={styles.title}>{title}</Text>
      <Text className={styles.description}>{description}</Text>
      {children ? <View className={styles.actions}>{children}</View> : null}
    </View>
  );
};

export default EmptyState;
