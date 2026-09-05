import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Minus, Plus } from '@nutui/icons-react-taro';
import EmptyState from '@/components/EmptyState';
import ShopProductImage from '@/components/ShopProductImage';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import {
  clampShopQuantity,
  fetchShopProduct,
  getShopProductQuantityIssue,
  getShopQuantityBounds,
  type ShopProduct,
} from '@/services/shop';
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
      setQuantity((current) => clampShopQuantity(nextProduct, current));
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
    const bounds = getShopQuantityBounds(product);
    if (!bounds.canPurchase) return;
    setQuantity((current) => clampShopQuantity(product, current + delta));
  };

  const handleBuy = () => {
    if (!product) return;
    const quantityIssue = getShopProductQuantityIssue(product, quantity);
    if (quantityIssue) {
      Taro.showToast({ title: quantityIssue, icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: `/pages/shop/order-confirm/index?id=${encodeURIComponent(product.id)}&quantity=${quantity}`,
    });
  };

  if (loading && !product) {
    return <View className={styles.state} style={viewportStyle}><Text>正在加载商品…</Text></View>;
  }

  if (error || !product) {
    return (
      <View className={styles.state} style={viewportStyle}>
        <EmptyState title="商品暂时不可用" description="可能已经下架，也可能是网络开了个小差。" />
        <View className={styles.retryButton} onClick={loadProduct}><Text>重新加载</Text></View>
      </View>
    );
  }

  const showsAlcoholMetadata = product.alcoholic
    || product.abv > 0
    || product.category.toLowerCase() === 'cocktail'
    || product.tags.some((tag) => tag.includes('酒精'));
  const quantityBounds = getShopQuantityBounds(product);
  const quantityIssue = getShopProductQuantityIssue(product, quantity);
  const decreaseDisabled = !quantityBounds.canPurchase || quantity <= quantityBounds.minQuantity;
  const increaseDisabled = !quantityBounds.canPurchase || quantity >= quantityBounds.maxQuantity;
  const buyButtonText = !product.enabled
    ? '已下架'
    : quantityBounds.canPurchase
      ? '立即购买'
      : '暂时售罄';

  return (
    <View className={styles.container} style={viewportStyle}>
      <View className={styles.cover}>
        <ShopProductImage
          className={styles.coverImage}
          src={product.imageUrl}
          mode="aspectFill"
        />
        <Text className={styles.coverCaption}>WORKER HOUSE SHOP</Text>
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
            <Text className={styles.metaLabel}>{showsAlcoholMetadata ? '酒精度' : '商品类型'}</Text>
            <Text className={styles.metaValue}>
              {showsAlcoholMetadata ? (product.alcoholic ? `${product.abv}%` : '无酒精') : (product.category || '商品')}
            </Text>
          </View>
          {product.volumeMl > 0 ? (
            <View className={styles.drinkMetaItem}>
              <Text className={styles.metaLabel}>容量</Text>
              <Text className={styles.metaValue}>{product.volumeMl} ml</Text>
            </View>
          ) : null}
          <View className={styles.drinkMetaItem}>
            <Text className={styles.metaLabel}>领取方式</Text>
            <Text className={styles.metaValue}>{product.fulfillmentLabel}</Text>
          </View>
        </View>

        <View className={styles.metaRow}>
          <View>
            <Text className={styles.metaLabel}>购买单位</Text>
            <Text className={styles.metaValue}>{product.unitLabel}</Text>
            <Text className={styles.quantityHint}>
              每单 {product.minQuantity}-{product.maxQuantity} {product.unitLabel}
              {product.stock === null ? '' : ` · 剩余 ${product.stock}`}
            </Text>
          </View>
          <View className={styles.quantityControl}>
            <View
              className={`${styles.quantityButton} ${decreaseDisabled ? styles.quantityButtonDisabled : ''}`}
              onClick={() => changeQuantity(-1)}
            ><Minus size="16" /></View>
            <Text className={styles.quantityValue}>{quantity}</Text>
            <View
              className={`${styles.quantityButton} ${increaseDisabled ? styles.quantityButtonDisabled : ''}`}
              onClick={() => changeQuantity(1)}
            ><Plus size="16" /></View>
          </View>
        </View>
      </View>

      <View className={styles.promiseCard}>
        <Text className={styles.promiseTitle}>{product.fulfillmentLabel}说明</Text>
        <Text className={styles.promiseText}>
          {product.fulfillmentType === 'delivery'
            ? '支付成功后将按订单中的收货地址安排配送。'
            : `支付成功后到店出示订单，由工作人员确认后${product.fulfillmentLabel}。`}
        </Text>
      </View>

      <View className={styles.footer}>
        <View className={`${styles.buyBtn} ${quantityIssue ? styles.buyBtnDisabled : ''}`} onClick={handleBuy}>
          <Text className={styles.buyBtnText}>{buyButtonText}</Text>
        </View>
      </View>
    </View>
  );
};

export default ProductDetailPage;
