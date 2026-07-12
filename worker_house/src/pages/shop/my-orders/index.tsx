import React, { useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import ShopImage from '@/components/ShopImage';
import { useShopStore } from '@/stores/shopStore';
import { formatPrice } from '@/utils/helpers';
import type { Order, OrderStatus } from '@/types/shop';
import styles from './index.module.scss';

const STATUS_GROUPS: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: '待付款' },
  { status: 'completed', label: '已完成' },
  { status: 'cancelled', label: '已取消' },
];

const STATUS_TEXT: Record<OrderStatus, string> = {
  pending: '待付款',
  completed: '已完成',
  cancelled: '已取消',
};

const MyOrdersPage: React.FC = () => {
  const orderList = useShopStore((state) => state.orderList);
  const bootstrapOrders = useShopStore((state) => state.bootstrapOrders);

  useEffect(() => {
    bootstrapOrders();
  }, [bootstrapOrders]);

  const grouped = useMemo(() => {
    return STATUS_GROUPS.map((group) => ({
      ...group,
      orders: orderList.filter((order) => order.status === group.status),
    })).filter((group) => group.orders.length > 0);
  }, [orderList]);

  const goShop = () => {
    Taro.switchTab({ url: '/pages/shop/home/index' });
  };

  const handleRebuy = (order: Order) => {
    const productId = order.items[0]?.product.id;
    if (productId) {
      Taro.navigateTo({ url: `/pages/shop/product-detail/index?id=${productId}` });
    }
  };

  const handleRefund = () => {
    Taro.showModal({
      title: '申请退款',
      content: '退款申请已提交，客服会在 1-3 个工作日内与你联系～',
      showCancel: false,
      confirmColor: '#E63946',
    });
  };

  if (orderList.length === 0) {
    return (
      <View className={styles.container}>
        <View className={styles.empty}>
          <View className={styles.emptyArt}>
            <Text className={styles.emptyEmoji}>🧾</Text>
          </View>
          <Text className={styles.emptyTitle}>还没有订单哦</Text>
          <Text className={styles.emptyDesc}>去挑几件社畜好物犒劳一下自己吧</Text>
          <View className={styles.emptyBtn} onClick={goShop}>
            <Text className={styles.emptyBtnText}>去逛逛</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className={styles.container}>
      <ScrollView scrollY className={styles.scroll}>
        {grouped.map((group) => (
          <View key={group.status} className={styles.group}>
            <View className={styles.groupHeader}>
              <Text className={styles.groupTitle}>{group.label}</Text>
              <Text className={styles.groupCount}>{group.orders.length}</Text>
            </View>

            {group.orders.map((order) => {
              const item = order.items[0];
              return (
                <View key={order.id} className={styles.card}>
                  <View className={styles.cardHeader}>
                    <Text className={styles.orderNo}>订单号 {order.id}</Text>
                    <Text className={`${styles.status} ${styles[`status_${order.status}`]}`}>
                      {STATUS_TEXT[order.status]}
                    </Text>
                  </View>

                  <View className={styles.cardBody}>
                    <ShopImage
                      src={item?.product.imageUrl ?? ''}
                      fallbackText={item?.product.name.slice(0, 2) ?? '好物'}
                      className={styles.thumb}
                    />
                    <View className={styles.bodyInfo}>
                      <Text className={styles.goodsName}>{item?.product.name ?? '商品'}</Text>
                      <Text className={styles.goodsSpec}>数量 x{item?.quantity ?? 1}</Text>
                    </View>
                    <Text className={styles.amount}>{formatPrice(order.totalAmount)}</Text>
                  </View>

                  <View className={styles.cardFooter}>
                    <View className={styles.actionBtn} onClick={() => handleRebuy(order)}>
                      <Text className={styles.actionText}>再次购买</Text>
                    </View>
                    {order.status === 'completed' ? (
                      <View className={`${styles.actionBtn} ${styles.actionGhost}`} onClick={handleRefund}>
                        <Text className={`${styles.actionText} ${styles.actionGhostText}`}>申请退款</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default MyOrdersPage;
