import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Input from '@nutui/nutui-react-taro/dist/es/packages/input/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '../nutuiStyles';
import {
  confirmAdminShopOrderFulfillment,
  fetchAdminShopOrders,
  type AdminShopOrder,
} from '@/services/admin';
import styles from '../shared.module.scss';

const toastId = 'admin-shop-orders-toast';

const paymentStatusText: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  failed: '支付失败',
  closed: '已关闭',
};

function formatDate(value: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '—';
}

function shippingStatusText(order: AdminShopOrder) {
  if (order.wechatShippingStatus === 'reported') return '微信已同步';
  if (order.wechatShippingStatus === 'reporting') return '微信同步中';
  if (order.wechatShippingStatus === 'failed') return '微信同步失败';
  if (order.wechatShippingStatus === 'pending') return '待同步微信';
  return '无需同步';
}

function canConfirmFulfillment(order: AdminShopOrder) {
  if (order.status !== 'paid') return false;
  if (order.fulfillmentType !== 'onsite' && order.fulfillmentType !== 'pickup') return false;
  if (order.wechatShippingStatus === 'reporting' || order.wechatShippingStatus === 'reported') return false;
  return order.fulfillmentStatus !== 'fulfilled' || order.wechatShippingStatus === 'failed' || order.wechatShippingStatus === 'pending';
}

function actionLabel(order: AdminShopOrder) {
  if (order.wechatShippingStatus === 'failed') return '重试微信上报';
  if (order.fulfillmentStatus === 'fulfilled') return '继续微信上报';
  return '确认到店交付';
}

const AdminShopOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchAdminShopOrders({ keyword, pageSize: 100 });
      setOrders(result.list);
    } catch (error) {
      Toast.show(toastId, {
        content: error instanceof Error ? error.message : '商城订单加载失败',
        icon: 'fail',
      });
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '商城订单与核销' });
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const handleConfirm = async (order: AdminShopOrder) => {
    if (processingId) return;
    if (order.fulfillmentStatus !== 'fulfilled') {
      const modal = await Taro.showModal({
        title: '确认已实际交付？',
        content: `请确认已将“${order.productName}”交给用户。确认后会按用户自提上报微信。`,
        confirmText: '确认交付',
      });
      if (!modal.confirm) return;
    }
    try {
      setProcessingId(order.id);
      const updated = await confirmAdminShopOrderFulfillment(order.id);
      setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
      Toast.show(toastId, {
        content: updated.wechatShippingStatus === 'reported' ? '交付已确认，微信履约已同步' : '交付已确认',
        icon: 'success',
      });
    } catch (error) {
      Toast.show(toastId, {
        content: error instanceof Error ? error.message : '确认交付失败',
        icon: 'fail',
      });
      await loadOrders();
    } finally {
      setProcessingId('');
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>商城订单与核销</Text>
        <Text className={styles.description}>用户实际拿到饮品后再确认交付。系统会按“用户自提”幂等同步微信订单履约状态。</Text>
      </View>

      <View className={styles.filtersCard}>
        <View className={styles.inputBlock}>
          <Input value={keywordInput} placeholder="搜索订单号 / 商品 / OpenID" onChange={setKeywordInput} />
        </View>
        <View className={styles.actionRow}>
          <Button type="primary" onClick={() => setKeyword(keywordInput.trim())}>搜索</Button>
          <Button onClick={() => { setKeywordInput(''); setKeyword(''); }}>重置</Button>
          <Button onClick={() => void loadOrders()}>{loading ? '刷新中…' : '刷新'}</Button>
        </View>
      </View>

      <View className={styles.listCard}>
        {loading && orders.length === 0 ? (
          <Text className={styles.emptyText}>商城订单加载中…</Text>
        ) : orders.length === 0 ? (
          <Text className={styles.emptyText}>暂无匹配的商城订单。</Text>
        ) : orders.map((order) => (
          <View key={order.id} className={styles.itemBlock}>
            <View className={styles.statusRow}>
              <Text className={styles.itemTitle}>{order.productName}</Text>
              <Text className={`${styles.statusPill} ${order.status === 'paid' ? styles.statusConfirmed : styles.statusPending}`}>
                {paymentStatusText[order.status] || order.status}
              </Text>
            </View>
            <Text className={styles.itemMeta}>订单号：{order.id}</Text>
            <Text className={styles.itemSummary}>金额：¥{(order.amount / 100).toFixed(2)} · 数量：{order.quantity} · {order.fulfillmentLabel}</Text>
            <Text className={styles.itemSummary}>下单：{formatDate(order.createdAt)} · 支付：{formatDate(order.paidAt)}</Text>
            <Text className={styles.itemSummary}>
              门店交付：{order.fulfillmentStatus === 'fulfilled' ? `已完成（${formatDate(order.fulfilledAt)}）` : '待确认'} · {shippingStatusText(order)}
            </Text>
            {order.wechatShippingError ? <Text className={styles.noteText}>上次失败：{order.wechatShippingError}</Text> : null}
            {canConfirmFulfillment(order) ? (
              <View className={styles.itemActions}>
                <Button
                  type="primary"
                  loading={processingId === order.id}
                  disabled={Boolean(processingId)}
                  onClick={() => void handleConfirm(order)}
                >
                  {processingId === order.id ? '处理中…' : actionLabel(order)}
                </Button>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminShopOrdersPage;
