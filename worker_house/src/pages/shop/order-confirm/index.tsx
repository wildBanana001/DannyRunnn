import React from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import styles from './index.module.scss';

const OrderConfirmPage: React.FC = () => {
  const router = useRouter();
  const productId = router.params.id || '';

  const handlePay = () => {
    Taro.redirectTo({ url: '/pages/shop/payment-result/index?status=success' });
  };

  return (
    <View className={styles.container}>
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>收货地址</Text>
        <Text className={styles.placeholder}>请选择收货地址（占位）</Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>商品信息</Text>
        <Text className={styles.placeholder}>商品 ID：{productId || '未指定'}</Text>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>小计</Text>
          <Text className={styles.rowValue}>¥0</Text>
        </View>
      </View>

      <View className={styles.footer}>
        <View className={styles.total}>
          <Text className={styles.totalLabel}>合计</Text>
          <Text className={styles.totalValue}>¥0</Text>
        </View>
        <View className={styles.payBtn} onClick={handlePay}>
          <Text className={styles.payBtnText}>提交订单</Text>
        </View>
      </View>
    </View>
  );
};

export default OrderConfirmPage;
