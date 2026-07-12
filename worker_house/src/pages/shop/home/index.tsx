import React, { useEffect } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import ShopImage from '@/components/ShopImage';
import { useShopStore } from '@/stores/shopStore';
import { formatPrice } from '@/utils/helpers';
import type { Product } from '@/types/shop';
import styles from './index.module.scss';

const ShopHomePage: React.FC = () => {
  const products = useShopStore((state) => state.products);
  const fetchProducts = useShopStore((state) => state.fetchProducts);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useDidShow(() => {
    fetchProducts();
  });

  const goDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/shop/product-detail/index?id=${id}` });
  };

  const goMyOrders = () => {
    Taro.navigateTo({ url: '/pages/shop/my-orders/index' });
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View className={styles.headerTop}>
          <Text className={styles.title}>社畜好物</Text>
          <View className={styles.ordersEntry} onClick={goMyOrders}>
            <Text className={styles.ordersEntryText}>我的订单</Text>
          </View>
        </View>
        <Text className={styles.subtitle}>给忙碌的你，一点点小确幸 🧸</Text>
        <View className={styles.sticker}>
          <Text className={styles.stickerText}>上新啦</Text>
        </View>
      </View>

      <ScrollView scrollY className={styles.scroll}>
        <View className={styles.grid}>
          {products.map((item: Product, index) => (
            <View
              key={item.id}
              className={styles.card}
              style={{ animationDelay: `${Math.min(index, 9) * 50}ms` }}
              onClick={() => goDetail(item.id)}
            >
              <View className={styles.coverWrap}>
                <ShopImage src={item.imageUrl} fallbackText={item.name.slice(0, 2)} className={styles.cover} />
                {item.badge ? (
                  <View className={`${styles.badge} ${item.badge === 'HOT' ? styles.badgeHot : ''}`}>
                    <Text className={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text className={styles.cardTitle}>{item.name}</Text>
              <View className={styles.priceRow}>
                <Text className={styles.cardPrice}>{formatPrice(item.price)}</Text>
                {item.originalPrice ? (
                  <Text className={styles.cardOrigin}>{formatPrice(item.originalPrice)}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
        <View className={styles.footHint}>
          <Text className={styles.footHintText}>—— 更多好物马上就来 ——</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default ShopHomePage;
