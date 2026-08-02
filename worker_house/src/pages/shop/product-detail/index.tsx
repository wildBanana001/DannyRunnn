import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Minus, Plus } from '@nutui/icons-react-taro';
import { resolveShopProductImage, shopProductImages } from '@/assets/shop';
import EmptyState from '@/components/EmptyState';
import SafeImage from '@/components/SafeImage';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import { fetchShopProduct, type ShopProduct } from '@/services/shop';
import styles from './index.module.scss';

const ProductDetailPage: React.FC = () => {
  const router = useRouter();
  const productId = router.params.id || '';
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const viewportStyle = useViewportLayout();

  const loadProduct = useCallback(async () => {
    if (!productId) {
      setError(true);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(false);
      const nextProduct = await fetchShopProduct(productId);
      setProduct(nextProduct);
      Taro.setNavigationBarTitle({ title: nextProduct.name });
    } catch (loadError) {
      console.warn('[shop] load product failed', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const changeQuantity = (delta: number) => {
    if (!product) return;
    setQuantity((current) => Math.max(1, Math.min(99, current + delta)));
  };

  const handleBuy = () => {
    if (!product || !product.enabled) {
      Taro.showToast({ title: '该商品已下架', icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: `/pages/shop/order-confirm/index?id=${encodeURIComponent(product.id)}&quantity=${quantity}`,
    });
  };

  if (loading && !product) {
    return <View className={styles.state} style={viewportStyle}><Text>正在翻开今晚的酒单…</Text></View>;
  }

  if (error || !product) {
    return (
      <View className={styles.state} style={viewportStyle}>
        <EmptyState title="这杯暂时不在酒单上" description="可能已经下架，也可能是网络开了个小差。" />
        <View className={styles.retryButton} onClick={loadProduct}><Text>重新加载</Text></View>
      </View>
    );
  }

  return (
    <View className={styles.container} style={viewportStyle}>
      <View className={styles.cover}>
        <SafeImage
          className={styles.coverImage}
          src={resolveShopProductImage(product.id, product.imageUrl)}
          fallbackSrc={shopProductImages['cocktail-afterwork-sour']}
          mode="aspectFill"
        />
        <Text className={styles.coverCaption}>WORKER HOUSE COCKTAILS</Text>
      </View>

      <View className={styles.info}>
        <View className={styles.tags}>
          {product.tags.map((tag) => <Text key={tag} className={styles.tag}>{tag}</Text>)}
        </View>
        <Text className={styles.title}>{product.name}</Text>
        <View className={styles.priceRow}>
          <Text className={styles.price}>¥{product.price.toFixed(2).replace(/\.00$/, '')}</Text>
          {product.originalPrice > product.price ? (
            <Text className={styles.originalPrice}>¥{product.originalPrice.toFixed(2).replace(/\.00$/, '')}</Text>
          ) : null}
        </View>
        <Text className={styles.desc}>{product.description}</Text>

        <View className={styles.drinkMeta}>
          <View className={styles.drinkMetaItem}>
            <Text className={styles.metaLabel}>酒精度</Text>
            <Text className={styles.metaValue}>{product.alcoholic ? `${product.abv}%` : '无酒精'}</Text>
          </View>
          <View className={styles.drinkMetaItem}>
            <Text className={styles.metaLabel}>容量</Text>
            <Text className={styles.metaValue}>{product.volumeMl} ml</Text>
          </View>
          <View className={styles.drinkMetaItem}>
            <Text className={styles.metaLabel}>享用方式</Text>
            <Text className={styles.metaValue}>{product.fulfillmentLabel}</Text>
          </View>
        </View>

        <View className={styles.metaRow}>
          <View>
            <Text className={styles.metaLabel}>出品方式</Text>
            <Text className={styles.metaValue}>现点现做</Text>
          </View>
          <View className={styles.quantityControl}>
            <View className={styles.quantityButton} onClick={() => changeQuantity(-1)}><Minus size="16" /></View>
            <Text className={styles.quantityValue}>{quantity}</Text>
            <View className={styles.quantityButton} onClick={() => changeQuantity(1)}><Plus size="16" /></View>
          </View>
        </View>
      </View>

      <View className={styles.promiseCard}>
        <Text className={styles.promiseTitle}>今晚这杯，认真对待</Text>
        <Text className={styles.promiseText}>
          {product.alcoholic
            ? '现点现做 · 到店后出示订单 · 请勿饮酒后驾车'
            : '现点现做 · 到店后出示订单 · 无酒精也有完整风味'}
        </Text>
      </View>

      <View className={styles.footer}>
        <View className={`${styles.buyBtn} ${!product.enabled ? styles.buyBtnDisabled : ''}`} onClick={handleBuy}>
          <Text className={styles.buyBtnText}>{product.enabled ? '选这杯' : '已下架'}</Text>
        </View>
      </View>
    </View>
  );
};

export default ProductDetailPage;
