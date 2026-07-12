import React from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';

// 商品占位数据（骨架阶段，后续接入 shopStore / BFF mock）
const PLACEHOLDER_PRODUCTS = [
  { id: 'p1', title: '社畜快乐屋帆布袋', price: 68 },
  { id: 'p2', title: '摸鱼咖啡挂耳礼盒', price: 88 },
  { id: 'p3', title: '打工人解压捏捏乐', price: 39 },
  { id: 'p4', title: '周末不上班马克杯', price: 58 }
];

const ShopHomePage: React.FC = () => {
  const goDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/shop/product-detail/index?id=${id}` });
  };

  const goMyOrders = () => {
    Taro.navigateTo({ url: '/pages/shop/my-orders/index' });
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.title}>社畜好物</Text>
        <Text className={styles.subtitle}>给忙碌的你，一点点小确幸</Text>
        <View className={styles.ordersEntry} onClick={goMyOrders}>
          <Text className={styles.ordersEntryText}>我的订单</Text>
        </View>
      </View>

      <ScrollView scrollY className={styles.scroll}>
        <View className={styles.grid}>
          {PLACEHOLDER_PRODUCTS.map((item) => (
            <View key={item.id} className={styles.card} onClick={() => goDetail(item.id)}>
              <View className={styles.cover}>
                <Text className={styles.coverPlaceholder}>商品图</Text>
              </View>
              <Text className={styles.cardTitle}>{item.title}</Text>
              <Text className={styles.cardPrice}>¥{item.price}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default ShopHomePage;
