import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { resolveShopProductImage, shopProductImages } from '@/assets/shop';
import EmptyState from '@/components/EmptyState';
import SafeImage from '@/components/SafeImage';
import { usePaymentErrorDialog } from '@/hooks/usePaymentErrorDialog';
import { ApiRequestError } from '@/services/apiError';
import { fetchRegistrationDetail } from '@/services/member';
import {
  confirmShopPayment,
  fetchShopOrder,
  isPaymentCancelled,
  launchShopPayment,
  retryShopPayment,
  type ShopOrder,
  type ShopOrderStatus,
} from '@/services/shop';
import styles from './index.module.scss';

const STATUS_TEXT: Record<ShopOrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  failed: '支付失败',
  closed: '已关闭',
};

function resolveOrderId(params: Record<string, string | undefined>) {
  return [
    params.orderId,
    params.outTradeNo,
    params.out_trade_no,
    params.merchantTradeNo,
    params.merchant_trade_no,
    params.id,
  ].find((value) => value?.trim())?.trim() || '';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '—';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isMissingShopOrder(error: unknown) {
  if (error instanceof ApiRequestError) return error.statusCode === 404;
  return error instanceof Error && error.message === '订单不存在';
}

function getFulfillmentState(order: ShopOrder) {
  if (order.fulfillmentType === 'delivery') {
    if (order.status !== 'paid') return '完成支付后，订单将按收货地址安排配送。';
    if (order.fulfillmentStatus === 'fulfilled') return '订单已确认交付。';
    return '订单待安排配送，请留意后续状态。';
  }
  const fulfillmentLabel = order.fulfillmentLabel || (order.fulfillmentType === 'pickup' ? '到店自取' : '到店享用');
  if (order.status !== 'paid') return `完成支付后，可凭本页订单${fulfillmentLabel}。`;
  if (order.fulfillmentStatus === 'fulfilled') return '门店已确认交付。';
  return `待${fulfillmentLabel}；到店后向工作人员出示本页订单号。`;
}

function getWechatShippingState(order: ShopOrder) {
  if (order.status !== 'paid' || order.mock || order.amount <= 0) return '';
  if (order.wechatShippingStatus === 'reported') return '微信订单履约状态已同步';
  if (order.wechatShippingStatus === 'reporting') return '微信订单履约状态同步中';
  if (order.wechatShippingStatus === 'failed') return '交付记录已保存，微信状态等待管理员重试同步';
  return '实际到店交付后同步微信订单履约状态';
}

const ShopOrderDetailPage: React.FC = () => {
  const router = useRouter();
  const orderId = resolveOrderId(router.params as Record<string, string | undefined>);
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const { paymentErrorDialog, showPaymentError } = usePaymentErrorDialog();

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError('缺少订单号，请从“我的订单”重新进入');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      setOrder(await fetchShopOrder(orderId));
    } catch (loadError) {
      if (isMissingShopOrder(loadError)) {
        try {
          const registration = await fetchRegistrationDetail(orderId);
          if (registration) {
            await Taro.redirectTo({
              url: `/pages/content/registration-detail/index?id=${encodeURIComponent(registration.id)}`,
            });
            return;
          }
        } catch (registrationError) {
          console.warn('[order-detail] activity order lookup failed', registrationError);
        }
      }
      setError(loadError instanceof Error ? loadError.message : '订单加载失败');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useDidShow(() => {
    void loadOrder();
  });

  const handleRetry = async () => {
    if (!order || retrying) return;
    try {
      setRetrying(true);
      const session = await retryShopPayment(order.id);
      await launchShopPayment(session);
      setOrder(await confirmShopPayment(order.id));
    } catch (retryError) {
      if (!isPaymentCancelled(retryError)) showPaymentError(retryError, '支付重试失败');
    } finally {
      setRetrying(false);
    }
  };

  const copyOrderId = async () => {
    if (!order) return;
    await Taro.setClipboardData({ data: order.id });
  };

  if (loading && !order) {
    return <View className={styles.state}><Text>正在读取订单…</Text></View>;
  }

  if (!order) {
    return (
      <View className={styles.state}>
        <EmptyState title="暂时无法查看订单" description={error || '请稍后重试。'} />
        <View className={styles.primaryButton} onClick={() => void loadOrder()}><Text>重新加载</Text></View>
      </View>
    );
  }

  const shippingState = getWechatShippingState(order);
  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.hero}>
        <Text className={styles.eyebrow}>ORDER DETAIL</Text>
        <View className={styles.titleRow}>
          <Text className={styles.title}>{STATUS_TEXT[order.status]}</Text>
          <Text className={`${styles.status} ${styles[`status_${order.status}`]}`}>{order.fulfillmentLabel}</Text>
        </View>
        <Text className={styles.fulfillmentState}>{getFulfillmentState(order)}</Text>
        {shippingState ? <Text className={styles.syncState}>{shippingState}</Text> : null}
      </View>

      <View className={styles.productCard}>
        <SafeImage
          className={styles.productImage}
          src={resolveShopProductImage(order.productId, order.productImageUrl)}
          fallbackSrc={shopProductImages['bottled-water-550ml']}
          mode="aspectFill"
        />
        <View className={styles.productInfo}>
          <Text className={styles.productName}>{order.productName}</Text>
          <Text className={styles.meta}>数量：{order.quantity} {order.unitLabel}</Text>
          <Text className={styles.amount}>{order.amount <= 0 ? '免费' : `¥${(order.amount / 100).toFixed(2)}`}</Text>
        </View>
      </View>

      <View className={styles.detailCard}>
        <View className={styles.detailRow}>
          <Text className={styles.label}>订单号</Text>
          <Text className={styles.value} onClick={() => void copyOrderId()}>{order.id}（点击复制）</Text>
        </View>
        <View className={styles.detailRow}>
          <Text className={styles.label}>下单时间</Text>
          <Text className={styles.value}>{formatDate(order.createdAt)}</Text>
        </View>
        <View className={styles.detailRow}>
          <Text className={styles.label}>支付时间</Text>
          <Text className={styles.value}>{order.paidAt ? formatDate(order.paidAt) : '—'}</Text>
        </View>
        <View className={styles.detailRow}>
          <Text className={styles.label}>履约方式</Text>
          <Text className={styles.value}>{order.fulfillmentLabel}</Text>
        </View>
        <View className={styles.detailRow}>
          <Text className={styles.label}>交付状态</Text>
          <Text className={styles.value}>{order.fulfillmentStatus === 'fulfilled' ? `已交付 ${formatDate(order.fulfilledAt)}` : '待交付'}</Text>
        </View>
        {order.remark ? (
          <View className={styles.detailRow}>
            <Text className={styles.label}>备注</Text>
            <Text className={styles.value}>{order.remark}</Text>
          </View>
        ) : null}
      </View>

      <View className={styles.actions}>
        {order.status === 'pending' ? (
          <View className={styles.primaryButton} onClick={() => void handleRetry()}>
            <Text>{retrying ? '处理中…' : (order.amount <= 0 ? '继续领取' : '继续支付')}</Text>
          </View>
        ) : null}
        <View className={styles.secondaryButton} onClick={() => Taro.redirectTo({ url: '/pages/shop/my-orders/index' })}>
          <Text>返回我的订单</Text>
        </View>
      </View>
      {paymentErrorDialog}
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default ShopOrderDetailPage;
