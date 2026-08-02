import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Minus, Plus } from '@nutui/icons-react-taro';
import { resolveShopProductImage, shopProductImages } from '@/assets/shop';
import EmptyState from '@/components/EmptyState';
import SafeImage from '@/components/SafeImage';
import { fetchShopProduct, type ShopProduct } from '@/services/shop';
import styles from './index.module.scss';

const ProductDetailPage: React.FC = () => {
  const router = useRouter();
  const productId = router.params.id || '';
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
    setQuantity((current) => Math.max(1, Math.min(product.stock, current + delta)));
  };

  const handleBuy = () => {
    if (!product || product.stock <= 0) {
      Taro.showToast({ title: '商品暂时售罄', icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: `/pages/shop/order-confirm/index?id=${encodeURIComponent(product.id)}&quantity=${quantity}`,
    });
  };

  if (loading && !product) {
    return <View className={styles.state}><Text>正在打开商品…</Text></View>;
  }

  if (error || !product) {
    return (
      <View className={styles.state}>
        <EmptyState title="商品走丢了" description="可能已下架，也可能是网络开了个小差。" />
        <View className={styles.retryButton} onClick={loadProduct}><Text>重新加载</Text></View>
      </View>
    );
  }

  return (
    <View className={styles.container}>
      <View className={styles.cover}>
        <SafeImage
          className={styles.coverImage}
          src={resolveShopProductImage(product.id, product.imageUrl)}
          fallbackSrc={shopProductImages['prod-coffee-box']}
          mode="aspectFill"
        />
        <Text className={styles.coverCaption}>WORKER HOUSE SELECT</Text>
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

        <View className={styles.metaRow}>
          <View>
            <Text className={styles.metaLabel}>库存</Text>
            <Text className={styles.metaValue}>{product.stock > 0 ? `${product.stock} 件` : '已售罄'}</Text>
          </View>
          <View className={styles.quantityControl}>
            <View className={styles.quantityButton} onClick={() => changeQuantity(-1)}><Minus size="16" /></View>
            <Text className={styles.quantityValue}>{quantity}</Text>
            <View className={styles.quantityButton} onClick={() => changeQuantity(1)}><Plus size="16" /></View>
          </View>
        </View>
      </View>

      <View className={styles.promiseCard}>
        <Text className={styles.promiseTitle}>小卖部承诺</Text>
        <Text className={styles.promiseText}>付款结果以微信支付服务端通知为准 · 有问题随时联系我们</Text>
      </View>

      <View className={styles.footer}>
        <View className={`${styles.buyBtn} ${product.stock <= 0 ? styles.buyBtnDisabled : ''}`} onClick={handleBuy}>
          <Text className={styles.buyBtnText}>{product.stock > 0 ? '立即购买' : '暂时售罄'}</Text>
        </View>
      </View>
    </View>
  );
};

export default ProductDetailPage;
