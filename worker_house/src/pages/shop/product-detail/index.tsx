import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import ShopImage from '@/components/ShopImage';
import { useEnterAnimation } from '@/hooks/useEnterAnimation';
import { useShopStore } from '@/stores/shopStore';
import { formatPrice } from '@/utils/helpers';
import type { Product } from '@/types/shop';
import styles from './index.module.scss';

const ProductDetailPage: React.FC = () => {
  const router = useRouter();
  const productId = router.params.id || '';
  const selectProduct = useShopStore((state) => state.selectProduct);
  const fetchProducts = useShopStore((state) => state.fetchProducts);
  const [product, setProduct] = useState<Product | null>(null);
  const { style: coverStyle } = useEnterAnimation({ offset: 40, duration: 360 });

  useEffect(() => {
    let mounted = true;
    (async () => {
      // 确保商品数据已就绪，再选中
      await fetchProducts();
      if (!mounted) {
        return;
      }
      setProduct(selectProduct(productId));
    })();
    return () => {
      mounted = false;
    };
  }, [productId, fetchProducts, selectProduct]);

  const handleShare = () => {
    Taro.showToast({ title: '点击右上角 · · · 分享给朋友', icon: 'none' });
  };

  const handleBuy = () => {
    if (!product) {
      return;
    }
    Taro.navigateTo({ url: `/pages/shop/order-confirm/index?id=${product.id}` });
  };

  if (!product) {
    return (
      <View className={styles.container}>
        <View className={styles.loading}>
          <Text className={styles.loadingText}>好物加载中…</Text>
        </View>
      </View>
    );
  }

  const soldOut = product.stock <= 0;

  return (
    <View className={styles.container}>
      <ScrollView scrollY className={styles.scroll}>
        <View className={styles.cover} style={coverStyle}>
          <ShopImage src={product.imageUrl} fallbackText={product.name.slice(0, 2)} className={styles.coverImg} />
        </View>

        <View className={styles.body}>
          <Text className={styles.name}>{product.name}</Text>

          <View className={styles.priceRow}>
            <Text className={styles.price}>{formatPrice(product.price)}</Text>
            {product.originalPrice ? (
              <Text className={styles.origin}>{formatPrice(product.originalPrice)}</Text>
            ) : null}
          </View>

          {product.tags && product.tags.length > 0 ? (
            <View className={styles.tagRow}>
              {product.tags.map((tag) => (
                <View key={tag} className={styles.tag}>
                  <Text className={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View className={styles.stockRow}>
            <View className={`${styles.stockTag} ${soldOut ? styles.stockOut : ''}`}>
              <Text className={styles.stockText}>{soldOut ? '暂时售罄' : `库存 ${product.stock} 件`}</Text>
            </View>
            <View className={styles.shipTag}>
              <Text className={styles.shipText}>下单后 48h 内发货</Text>
            </View>
          </View>

          <View className={styles.noteCard}>
            <Text className={styles.noteTitle}>好物简介</Text>
            <Text className={styles.noteDesc}>{product.description}</Text>
          </View>
        </View>
      </ScrollView>

      <View className={styles.footer}>
        <View className={styles.shareBtn} onClick={handleShare}>
          <Text className={styles.shareIcon}>↗</Text>
          <Text className={styles.shareText}>分享</Text>
        </View>
        <View
          className={`${styles.buyBtn} ${soldOut ? styles.buyDisabled : ''}`}
          onClick={soldOut ? undefined : handleBuy}
        >
          <Text className={styles.buyBtnText}>{soldOut ? '已售罄' : '立即购买'}</Text>
        </View>
      </View>
    </View>
  );
};

export default ProductDetailPage;
