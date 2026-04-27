import React from 'react';
import { Text, View } from '@tarojs/components';
import styles from './index.module.scss';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description = '暂无内容，先去逛逛别的页面吧。',
  icon = '◌'
}) => {
  return (
    <View className={styles.container}>
      <Text className={styles.icon}>{icon}</Text>
      <Text className={styles.title}>{title}</Text>
      <Text className={styles.description}>{description}</Text>
    </View>
  );
};

export default EmptyState;
