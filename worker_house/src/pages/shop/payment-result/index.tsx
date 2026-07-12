import React, { useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useShopStore } from '@/stores/shopStore';
import { formatPrice } from '@/utils/helpers';
import type { Order } from '@/types/shop';
import styles from './index.module.scss';

const PaymentResultPage: React.FC = () => {
  const router = useRouter();
  const isSuccess = router.params.status !== 'fail';
  const finalizeOrder = useShopStore((state) => state.finalizeOrder);
  const [order, setOrder] = useState<Order | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // 支付成功落库订单（待付款→已完成），失败则保留待付款
    const result = finalizeOrder(isSuccess ? 'completed' : 'pending');
    setOrder(result);
    // 触发圆圈弹性弹出动画
    const timer = setTimeout(() => setShown(true), 60);
    return () => clearTimeout(timer);
  }, [finalizeOrder, isSuccess]);

  const goOrders = () => {
    Taro.redirectTo({ url: '/pages/shop/my-orders/index' });
  };

  const goShop = () => {
    Taro.switchTab({ url: '/pages/shop/home/index' });
  };

  return (
    <View className={styles.container}>
      <View className={`${styles.icon} ${isSuccess ? styles.iconSuccess : styles.iconFail} ${shown ? styles.iconShown : ''}`}>
        <Text className={styles.iconText}>{isSuccess ? '✓' : '✕'}</Text>
      </View>

      <Text className={styles.title}>{isSuccess ? '支付成功' : '支付失败'}</Text>
      <Text className={styles.subtitle}>
        {isSuccess ? '感谢你的支持，好物马上安排～' : '订单未完成支付，可在订单里继续付款'}
      </Text>

      {order ? (
        <View className={styles.orderCard}>
          <View className={styles.orderRow}>
            <Text className={styles.orderLabel}>订单号</Text>
            <Text className={styles.orderValue}>{order.id}</Text>
          </View>
          <View className={styles.orderRow}>
            <Text className={styles.orderLabel}>支付金额</Text>
            <Text className={styles.orderAmount}>{formatPrice(order.totalAmount)}</Text>
          </View>
        </View>
      ) : null}

      <View className={styles.actions}>
        <View className={styles.primaryBtn} onClick={goOrders}>
          <Text className={styles.primaryBtnText}>查看订单</Text>
        </View>
        <View className={styles.ghostBtn} onClick={goShop}>
          <Text className={styles.ghostBtnText}>继续逛逛</Text>
        </View>
      </View>
    </View>
  );
};

export default PaymentResultPage;
