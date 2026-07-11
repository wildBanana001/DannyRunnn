import React from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';

// 订单占位数据（骨架阶段，后续接入 shopStore / BFF mock）
const PLACEHOLDER_ORDERS = [
  { id: 'o1', title: '社畜快乐屋帆布袋', status: '待付款', amount: 68 },
  { id: 'o2', title: '摸鱼咖啡挂耳礼盒', status: '已完成', amount: 88 }
];

const MyOrdersPage: React.FC = () => {
  const goDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/shop/product-detail/index?id=${id}` });
  };

  return (
    <View className={styles.container}>
      <ScrollView scrollY className={styles.scroll}>
        {PLACEHOLDER_ORDERS.map((item) => (
          <View key={item.id} className={styles.card} onClick={() => goDetail(item.id)}>
            <View className={styles.cardHeader}>
              <Text className={styles.orderNo}>订单号：{item.id}</Text>
              <Text className={styles.status}>{item.status}</Text>
            </View>
            <View className={styles.cardBody}>
              <View className={styles.thumb}>
                <Text className={styles.thumbPlaceholder}>图</Text>
              </View>
              <Text className={styles.cardTitle}>{item.title}</Text>
              <Text className={styles.amount}>¥{item.amount}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default MyOrdersPage;
