import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import {
  fetchShopOrder,
  isPaymentCancelled,
  launchShopPayment,
  retryShopPayment,
  type ShopOrderStatus,
} from '@/services/shop';
import styles from './index.module.scss';

type ResultStatus = 'success' | 'pending' | 'fail';

const COPY: Record<ResultStatus, { icon: string; title: string; subtitle: string }> = {
  success: { icon: '✓', title: '支付成功', subtitle: '订单已经确认，我们会尽快安排后续处理。' },
  pending: { icon: '…', title: '等待支付确认', subtitle: '取消支付或回调延迟都不会丢单，可以继续支付或稍后查看。' },
  fail: { icon: '!', title: '支付未完成', subtitle: '订单没有完成支付，请稍后重试。' },
};

function mapOrderStatus(status: ShopOrderStatus): ResultStatus {
  if (status === 'paid') return 'success';
  if (status === 'pending') return 'pending';
  return 'fail';
}

const PaymentResultPage: React.FC = () => {
  const router = useRouter();
  const orderId = router.params.orderId || '';
  const initialStatus: ResultStatus = router.params.status === 'success'
    ? 'success'
    : router.params.status === 'pending'
      ? 'pending'
      : 'fail';
  const [status, setStatus] = useState<ResultStatus>(initialStatus);
  const [checking, setChecking] = useState(Boolean(orderId));
  const [retrying, setRetrying] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      setChecking(true);
      const order = await fetchShopOrder(orderId);
      setStatus(mapOrderStatus(order.status));
    } catch (error) {
      console.warn('[shop] refresh payment status failed', error);
    } finally {
      setChecking(false);
    }
  }, [orderId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleRetry = async () => {
    if (!orderId || retrying) return;
    try {
      setRetrying(true);
      const session = await retryShopPayment(orderId);
      await launchShopPayment(session);
      await refreshStatus();
    } catch (error) {
      if (!isPaymentCancelled(error)) {
        const message = error instanceof Error ? error.message : '支付重试失败';
        Taro.showToast({ title: message.slice(0, 20), icon: 'none' });
      }
    } finally {
      setRetrying(false);
    }
  };

  const copy = COPY[status];

  return (
    <View className={styles.container}>
      <View className={`${styles.icon} ${styles[status]}`}>
        <Text className={styles.iconText}>{checking ? '↻' : copy.icon}</Text>
      </View>
      <Text className={styles.eyebrow}>PAYMENT RESULT</Text>
      <Text className={styles.title}>{checking ? '正在确认支付结果' : copy.title}</Text>
      <Text className={styles.subtitle}>{copy.subtitle}</Text>
      {orderId ? <Text className={styles.orderNo}>订单号 {orderId}</Text> : null}

      <View className={styles.actions}>
        {status === 'pending' && !checking ? (
          <View className={styles.primaryBtn} onClick={handleRetry}>
            <Text className={styles.primaryBtnText}>{retrying ? '正在拉起支付…' : '继续支付'}</Text>
          </View>
        ) : null}
        <View className={status === 'pending' ? styles.ghostBtn : styles.primaryBtn} onClick={() => Taro.redirectTo({ url: '/pages/shop/my-orders/index' })}>
          <Text className={status === 'pending' ? styles.ghostBtnText : styles.primaryBtnText}>查看订单</Text>
        </View>
        <View className={styles.textButton} onClick={() => Taro.switchTab({ url: '/pages/shop-home/index' })}>
          <Text>继续逛逛</Text>
        </View>
      </View>
    </View>
  );
};

export default PaymentResultPage;
