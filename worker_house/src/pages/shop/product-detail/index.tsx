import React from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import styles from './index.module.scss';

const ProductDetailPage: React.FC = () => {
  const router = useRouter();
  const productId = router.params.id || '';

  const handleBuy = () => {
    Taro.navigateTo({ url: `/pages/shop/order-confirm/index?id=${productId}` });
  };

  return (
    <View className={styles.container}>
      <View className={styles.cover}>
        <Text className={styles.coverPlaceholder}>商品大图</Text>
      </View>

      <View className={styles.info}>
        <Text className={styles.title}>商品名称占位</Text>
        <Text className={styles.price}>¥0</Text>
        <Text className={styles.desc}>商品详情描述占位（商品 ID：{productId || '未指定'}）</Text>
      </View>

      <View className={styles.footer}>
        <View className={styles.buyBtn} onClick={handleBuy}>
          <Text className={styles.buyBtnText}>立即购买</Text>
        </View>
      </View>
    </View>
  );
};

export default ProductDetailPage;
