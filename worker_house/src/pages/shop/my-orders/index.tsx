import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, View, type ITouchEvent } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import WxLoginModal from '@/components/WxLoginModal/WxLoginModal';
import EmptyState from '@/components/EmptyState';
import {
  confirmShopPayment,
  fetchMyShopOrders,
  isPaymentCancelled,
  launchShopPayment,
  retryShopPayment,
  type ShopOrder,
  type ShopOrderStatus,
} from '@/services/shop';
import { useUserStore } from '@/store/userStore';
import styles from './index.module.scss';

const STATUS_TEXT: Record<ShopOrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  failed: '支付失败',
  closed: '已关闭',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const MyOrdersPage: React.FC = () => {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState('');
  const wasLoggedInRef = useRef(isLoggedIn);

  const loadOrders = useCallback(async () => {
    if (!isLoggedIn) {
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(false);
      setOrders(await fetchMyShopOrders());
    } catch (loadError) {
      console.warn('[shop] load orders failed', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useDidShow(() => {
    loadOrders();
  });

  useEffect(() => {
    if (isLoggedIn && !wasLoggedInRef.current) {
      loadOrders();
    }
    wasLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn, loadOrders]);

  const handleRetry = async (event: ITouchEvent, orderId: string) => {
    event.stopPropagation();
    if (payingOrderId) return;
    try {
      setPayingOrderId(orderId);
      const session = await retryShopPayment(orderId);
      await launchShopPayment(session);
      const refreshed = await confirmShopPayment(orderId);
      setOrders((current) => current.map((item) => item.id === orderId ? refreshed : item));
      if (refreshed.status === 'paid') {
        Taro.showToast({ title: '支付成功', icon: 'success' });
      }
    } catch (payError) {
      if (!isPaymentCancelled(payError)) {
        const message = payError instanceof Error ? payError.message : '支付失败';
        Taro.showToast({ title: message.slice(0, 20), icon: 'none' });
      }
    } finally {
      setPayingOrderId('');
    }
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.eyebrow}>MY PURCHASES</Text>
        <Text className={styles.title}>我的订单</Text>
        <Text className={styles.subtitle}>付款状态以后端确认结果为准</Text>
      </View>

      <ScrollView scrollY className={styles.scroll}>
        {!isLoggedIn ? (
          <View className={styles.loginState}>
            <EmptyState title="登录后查看订单" description="订单会跟随你的微信身份安全保存。" />
            <View className={styles.primaryButton} onClick={() => setShowLogin(true)}><Text>微信登录</Text></View>
          </View>
        ) : null}

        {isLoggedIn && loading && orders.length === 0 ? <View className={styles.state}><Text>正在翻订单本…</Text></View> : null}

        {isLoggedIn && error && orders.length === 0 ? (
          <View className={styles.state}>
            <EmptyState title="订单加载失败" description="请检查网络后重试。" />
            <View className={styles.primaryButton} onClick={loadOrders}><Text>重新加载</Text></View>
          </View>
        ) : null}

        {isLoggedIn && !loading && !error && orders.length === 0 ? (
          <View className={styles.state}>
            <EmptyState title="还没有商城订单" description="逛逛小卖部，挑一件奖励自己的好物。" />
            <View className={styles.primaryButton} onClick={() => Taro.switchTab({ url: '/pages/shop-home/index' })}><Text>去商城看看</Text></View>
          </View>
        ) : null}

        {orders.length > 0 ? (
          <View className={styles.list}>
            {orders.map((item) => (
              <View key={item.id} className={styles.card} onClick={() => Taro.navigateTo({ url: `/pages/shop/product-detail/index?id=${encodeURIComponent(item.productId)}` })}>
                <View className={styles.cardHeader}>
                  <View>
                    <Text className={styles.orderDate}>{formatDate(item.createdAt)}</Text>
                    <Text className={styles.orderNo}>订单号 {item.id}</Text>
                  </View>
                  <Text className={`${styles.status} ${styles[`status_${item.status}`]}`}>{STATUS_TEXT[item.status]}</Text>
                </View>
                <View className={styles.cardBody}>
                  <View className={styles.thumb}>
                    {item.productImageUrl ? <Image className={styles.thumbImage} src={item.productImageUrl} mode="aspectFill" /> : <Text>🎁</Text>}
                  </View>
                  <View className={styles.productInfo}>
                    <Text className={styles.cardTitle}>{item.productName}</Text>
                    <Text className={styles.quantity}>数量 × {item.quantity}</Text>
                  </View>
                  <Text className={styles.amount}>¥{(item.amount / 100).toFixed(2)}</Text>
                </View>
                <View className={styles.cardFooter}>
                  <Text className={styles.address}>{item.address?.name ? `收件人：${item.address.name}` : '收货信息待补充'}</Text>
                  {item.status === 'pending' ? (
                    <View className={styles.payButton} onClick={(event) => handleRetry(event, item.id)}>
                      <Text>{payingOrderId === item.id ? '处理中…' : '继续支付'}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <View className={styles.bottomSpacing} />
      </ScrollView>

      <WxLoginModal visible={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />
    </View>
  );
};

export default MyOrdersPage;
