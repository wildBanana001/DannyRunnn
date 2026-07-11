import React from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import styles from './index.module.scss';

const PaymentResultPage: React.FC = () => {
  const router = useRouter();
  const isSuccess = router.params.status !== 'fail';

  const goOrders = () => {
    Taro.redirectTo({ url: '/pages/shop/my-orders/index' });
  };

  const goShop = () => {
    Taro.switchTab({ url: '/pages/shop/home/index' });
  };

  return (
    <View className={styles.container}>
      <View className={styles.icon}>
        <Text className={styles.iconText}>{isSuccess ? '✓' : '✕'}</Text>
      </View>
      <Text className={styles.title}>{isSuccess ? '支付成功' : '支付失败'}</Text>
      <Text className={styles.subtitle}>
        {isSuccess ? '感谢你的支持，好物马上安排～' : '订单未完成支付，请重试'}
      </Text>

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
