import React from 'react';
import { ScrollView, View } from '@tarojs/components';
import EmptyState from '@/components/EmptyState';
import styles from './index.module.scss';

const MyCardsPage: React.FC = () => (
  <ScrollView className={styles.container} scrollY enableFlex>
    <View className={styles.emptyCardWrap}>
      <EmptyState
        title="次卡暂未开放"
        description="次卡购买与活动抵扣仍在完善中，当前活动统一使用微信支付。"
      />
    </View>
    <View className={styles.bottomSpacing} />
  </ScrollView>
);

export default MyCardsPage;
