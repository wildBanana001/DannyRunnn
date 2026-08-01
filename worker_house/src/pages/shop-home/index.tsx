import React, { useCallback, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import EmptyState from '@/components/EmptyState';
import { fetchShopProducts, type ShopProduct } from '@/services/shop';
import styles from './index.module.scss';

const PRODUCT_EMOJI: Record<string, string> = {
  'prod-coffee-box': '☕',
  'prod-fish-tote': '👜',
  'prod-stress-ball': '🫠',
  'prod-thermos-cup': '🥤',
  'prod-monday-stickers': '🏷️',
  'prod-off-work-slippers': '🩴',
};

function formatPrice(price: number) {
  return price.toFixed(2).replace(/\.00$/, '');
}

const ShopHomePage: React.FC = () => {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      setProducts(await fetchShopProducts());
    } catch (loadError) {
      console.warn('[shop] load products failed', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    loadProducts();
  });

  const goDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/shop/product-detail/index?id=${encodeURIComponent(id)}` });
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View>
          <Text className={styles.eyebrow}>WORKER HOUSE SELECT</Text>
          <Text className={styles.title}>社畜好物</Text>
          <Text className={styles.subtitle}>认真生活，也认真奖励自己</Text>
        </View>
        <View className={styles.ordersEntry} onClick={() => Taro.navigateTo({ url: '/pages/shop/my-orders/index' })}>
          <Text className={styles.ordersEntryIcon}>⌁</Text>
          <Text className={styles.ordersEntryText}>订单</Text>
        </View>
      </View>

      <ScrollView scrollY className={styles.scroll}>
        <View className={styles.notice}>
          <Text className={styles.noticeTitle}>本周小卖部</Text>
          <Text className={styles.noticeText}>少量上新 · 售完就去认真上班</Text>
        </View>

        {loading && products.length === 0 ? (
          <View className={styles.state}><Text>正在整理货架…</Text></View>
        ) : null}

        {error && products.length === 0 ? (
          <View className={styles.errorState}>
            <EmptyState title="货架暂时走神了" description="稍后再来看看，或者点下面重新加载。" />
            <View className={styles.retryButton} onClick={loadProducts}><Text>重新加载</Text></View>
          </View>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <EmptyState title="商品准备中" description="好东西正在路上。" />
        ) : null}

        {products.length > 0 ? (
          <View className={styles.grid}>
            {products.map((item, index) => (
              <View key={item.id} className={styles.card} onClick={() => goDetail(item.id)}>
                <View className={`${styles.cover} ${index % 2 === 0 ? styles.coverWarm : styles.coverCool}`}>
                  {item.imageUrl ? (
                    <Image className={styles.coverImage} src={item.imageUrl} mode="aspectFill" lazyLoad />
                  ) : (
                    <Text className={styles.coverEmoji}>{PRODUCT_EMOJI[item.id] || '🎁'}</Text>
                  )}
                  {item.tags[0] ? <Text className={styles.tag}>{item.tags[0]}</Text> : null}
                </View>
                <Text className={styles.cardTitle}>{item.name}</Text>
                <View className={styles.priceRow}>
                  <Text className={styles.cardPrice}>¥{formatPrice(item.price)}</Text>
                  {item.originalPrice > item.price ? (
                    <Text className={styles.originalPrice}>¥{formatPrice(item.originalPrice)}</Text>
                  ) : null}
                </View>
                <Text className={styles.stock}>{item.stock > 0 ? `还剩 ${item.stock} 件` : '暂时售罄'}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View className={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

export default ShopHomePage;
