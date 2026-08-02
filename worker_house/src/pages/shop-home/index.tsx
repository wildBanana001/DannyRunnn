import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { ArrowRight, Order } from '@nutui/icons-react-taro';
import EmptyState from '@/components/EmptyState';
import SafeImage from '@/components/SafeImage';
import { resolveShopProductImage, shopProductImages } from '@/assets/shop';
import { fetchShopProducts, type ShopProduct } from '@/services/shop';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import styles from './index.module.scss';

function formatPrice(price: number) {
  return price.toFixed(2).replace(/\.00$/, '');
}

const ShopHomePage: React.FC = () => {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const viewportStyle = useViewportLayout({ fallbackTopGapRpx: 50, reserveH5TabBar: true });

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
    <View className={styles.container} style={viewportStyle}>
      <View className={styles.header}>
        <View>
          <Text className={styles.eyebrow}>WORKER HOUSE COCKTAILS</Text>
          <Text className={styles.title}>今晚喝一杯</Text>
          <Text className={styles.subtitle}>下班以后，认真放松</Text>
        </View>
        <View className={styles.ordersEntry} onClick={() => Taro.navigateTo({ url: '/pages/shop/my-orders/index' })}>
          <Order className={styles.ordersEntryIcon} size="18" />
          <Text className={styles.ordersEntryText}>订单</Text>
          <ArrowRight className={styles.ordersEntryArrow} size="13" />
        </View>
      </View>

      <ScrollView scrollY className={styles.scroll}>
        <View className={styles.notice}>
          <Text className={styles.noticeTitle}>今日酒单</Text>
          <Text className={styles.noticeText}>现点现做 · 到店享用 · 不提供配送</Text>
        </View>

        {loading && products.length === 0 ? (
          <View className={styles.state}><Text>正在准备今晚的酒单…</Text></View>
        ) : null}

        {error && products.length === 0 ? (
          <View className={styles.errorState}>
            <EmptyState title="酒单暂时走神了" description="稍后再来看看，或者点下面重新加载。" />
            <View className={styles.retryButton} onClick={loadProducts}><Text>重新加载</Text></View>
          </View>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <EmptyState title="今日酒单准备中" description="调酒师正在认真准备，晚点再来看看。" />
        ) : null}

        {products.length > 0 ? (
          <View className={styles.grid}>
            {products.map((item, index) => (
              <View key={item.id} className={styles.card} onClick={() => goDetail(item.id)}>
                <View className={`${styles.cover} ${index % 2 === 0 ? styles.coverWarm : styles.coverCool}`}>
                  <SafeImage
                    className={styles.coverImage}
                    src={resolveShopProductImage(item.id, item.imageUrl)}
                    fallbackSrc={shopProductImages['cocktail-afterwork-sour']}
                    mode="aspectFill"
                    lazyLoad
                  />
                  {item.tags[0] ? <Text className={styles.tag}>{item.tags[0]}</Text> : null}
                </View>
                <Text className={styles.cardTitle}>{item.name}</Text>
                <View className={styles.priceRow}>
                  <Text className={styles.cardPrice}>¥{formatPrice(item.price)}</Text>
                  {item.originalPrice > item.price ? (
                    <Text className={styles.originalPrice}>¥{formatPrice(item.originalPrice)}</Text>
                  ) : null}
                </View>
                <Text className={styles.fulfillmentNote}>现点现做 · 到店享用</Text>
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
