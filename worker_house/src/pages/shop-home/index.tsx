import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { ArrowRight, Order } from '@nutui/icons-react-taro';
import EmptyState from '@/components/EmptyState';
import ShopProductImage from '@/components/ShopProductImage';
import { fetchShopProducts, type ShopProduct } from '@/services/shop';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import styles from './index.module.scss';

function formatPrice(price: number) {
  return price.toFixed(2).replace(/\.00$/, '');
}

interface ProductGridProps {
  products: ShopProduct[];
  onSelect: (id: string) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ products, onSelect }) => (
  <View className={styles.grid}>
    {products.map((item, index) => (
      <View key={item.id} className={styles.card} onClick={() => onSelect(item.id)}>
        <View className={`${styles.cover} ${index % 2 === 0 ? styles.coverWarm : styles.coverCool}`}>
          <ShopProductImage
            className={styles.coverImage}
            src={item.imageUrl}
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
        <Text className={styles.fulfillmentNote}>{item.fulfillmentLabel}</Text>
      </View>
    ))}
  </View>
);

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

  const wineMenuProducts = products.filter((item) => item.category.toLowerCase() === 'cocktail');
  const otherProducts = products.filter((item) => item.category.toLowerCase() !== 'cocktail');

  return (
    <View className={styles.container} style={viewportStyle}>
      <View className={styles.header}>
        <View>
          <Text className={styles.eyebrow}>WORKER HOUSE SHOP</Text>
          <Text className={styles.title}>当期好物</Text>
          <Text className={styles.subtitle}>好物与饮品，随时更新</Text>
        </View>
        <View className={styles.ordersEntry} onClick={() => Taro.navigateTo({ url: '/pages/shop/my-orders/index' })}>
          <Order className={styles.ordersEntryIcon} size="18" />
          <Text className={styles.ordersEntryText}>订单</Text>
          <ArrowRight className={styles.ordersEntryArrow} size="13" />
        </View>
      </View>

      <ScrollView scrollY className={styles.scroll}>
        <View className={styles.notice}>
          <Text className={styles.noticeTitle}>在售商品</Text>
          <Text className={styles.noticeText}>商品信息与价格以当前页面为准</Text>
        </View>

        {loading && products.length === 0 ? (
          <View className={styles.state}><Text>正在准备商品…</Text></View>
        ) : null}

        {error && products.length === 0 ? (
          <View className={styles.errorState}>
            <EmptyState title="商品暂时加载失败" description="稍后再来看看，或者点下面重新加载。" />
            <View className={styles.retryButton} onClick={loadProducts}><Text>重新加载</Text></View>
          </View>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <EmptyState title="商品准备中" description="稍后再来看看。" />
        ) : null}

        {wineMenuProducts.length > 0 ? (
          <View className={styles.catalogSection}>
            <View className={styles.sectionHeading}>
              <Text className={styles.sectionTitle}>酒单</Text>
              <Text className={styles.sectionDescription}>酒款、价格和上下架状态均由服务端实时下发</Text>
            </View>
            <ProductGrid products={wineMenuProducts} onSelect={goDetail} />
          </View>
        ) : null}

        {otherProducts.length > 0 ? (
          <View className={styles.catalogSection}>
            <View className={styles.sectionHeading}>
              <Text className={styles.sectionTitle}>其他在售</Text>
              <Text className={styles.sectionDescription}>饮品与周边按服务端配置展示</Text>
            </View>
            <ProductGrid products={otherProducts} onSelect={goDetail} />
          </View>
        ) : null}
        <View className={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

export default ShopHomePage;
