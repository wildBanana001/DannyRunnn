import React, { useCallback, useEffect, useState } from 'react';
import { Picker, ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Input from '@nutui/nutui-react-taro/dist/es/packages/input/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { fetchAdminCardOrders } from '@/services/admin';
import type { CardOrder, CardOrderStatus } from '@/types';
import { formatPrice } from '@/utils/helpers';
import styles from '../shared.module.scss';

const toastId = 'admin-card-orders-toast';
const pageSize = 20;
const statusOptions: Array<{ label: string; value: CardOrderStatus | '' }> = [
  { label: '全部状态', value: '' },
  { label: '生效中', value: 'active' },
  { label: '已耗尽', value: 'exhausted' },
  { label: '已过期', value: 'expired' },
  { label: '已退款', value: 'refunded' },
];

const statusTextMap: Record<string, string> = {
  active: '生效中',
  exhausted: '已耗尽',
  expired: '已过期',
  refunded: '已退款',
};

const statusClassMap: Record<string, string> = {
  active: styles.statusActive,
  exhausted: styles.statusExhausted,
  expired: styles.statusExpired,
  refunded: styles.statusRefunded,
};

const AdminCardOrdersPage: React.FC = () => {
  const [records, setRecords] = useState<CardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<CardOrderStatus | ''>('');
  const [userId, setUserId] = useState('');
  const [cardType, setCardType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const statusIndex = Math.max(statusOptions.findIndex((item) => item.value === status), 0);

  const loadOrders = useCallback(async (nextPage = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const result = await fetchAdminCardOrders({
        cardType: cardType.trim() || undefined,
        keyword,
        page: nextPage,
        pageSize,
        status: status || undefined,
        userId: userId.trim() || undefined,
      });
      setTotal(result.total);
      setPage(nextPage);
      setRecords((current) => append ? [...current, ...result.list] : result.list);
    } catch (error) {
      const message = error instanceof Error ? error.message : '次卡订单加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cardType, keyword, status, userId]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '次卡订单' });
  }, []);

  useEffect(() => {
    void loadOrders(1, false);
  }, [loadOrders]);

  const hasMore = records.length < total;

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>次卡订单</Text>
        <Text className={styles.description}>支持按用户 OpenID、卡类型、状态和关键词筛选次卡订单。</Text>
      </View>

      <View className={styles.filtersCard}>
        <View className={styles.filterRow}>
          <View className={styles.inputBlock}>
            <Input value={userId} placeholder="用户 OpenID" onChange={setUserId} />
          </View>
          <View className={styles.pickerBlock}>
            <Picker mode="selector" range={statusOptions} rangeKey="label" value={statusIndex} onChange={(event) => setStatus(statusOptions[event.detail.value]?.value || '')}>
              <View className={styles.pickerValue}>{statusOptions[statusIndex]?.label || '全部状态'}</View>
            </Picker>
          </View>
        </View>
        <View className={styles.filterRow}>
          <View className={styles.inputBlock}>
            <Input value={cardType} placeholder="卡类型精确筛选" onChange={setCardType} />
          </View>
        </View>
        <View className={styles.filterRow}>
          <View className={styles.inputBlock}>
            <Input value={keywordInput} placeholder="搜索昵称 / 微信号 / 订单 ID" onChange={setKeywordInput} />
          </View>
        </View>
        <View className={styles.actionRow}>
          <Button type="primary" onClick={() => setKeyword(keywordInput.trim())}>搜索</Button>
          <Button onClick={() => { setUserId(''); setCardType(''); setKeywordInput(''); setKeyword(''); setStatus(''); }}>重置</Button>
          <Button onClick={() => void loadOrders(1, false)}>{loading ? '刷新中…' : '刷新列表'}</Button>
        </View>
      </View>

      <View className={styles.listCard}>
        {loading ? (
          <Text className={styles.emptyText}>次卡订单加载中…</Text>
        ) : records.length === 0 ? (
          <Text className={styles.emptyText}>暂无匹配记录。</Text>
        ) : (
          <>
            {records.map((item) => (
              <View key={item.id} className={styles.itemBlock}>
                <View className={styles.statusRow}>
                  <Text className={styles.itemTitle}>{item.cardType}</Text>
                  <Text className={`${styles.statusPill} ${statusClassMap[item.status] || styles.statusPending}`}>{statusTextMap[item.status] || item.status}</Text>
                </View>
                <Text className={styles.itemMeta}>{item.userNickname || '未命名用户'} · {item.userWechatName || '未填写微信号'}</Text>
                <Text className={styles.itemSummary}>剩余 {item.remainingCount}/{item.totalCount} 次 · 已付 {formatPrice(item.amount)}</Text>
                <Text className={styles.itemSummary}>OpenID：{item.openid || '未下发'} </Text>
                <View className={styles.itemActions}>
                  <Button type="primary" onClick={() => Taro.navigateTo({ url: `/pages/admin/card-order-detail/index?id=${item.id}` })}>查看详情</Button>
                </View>
              </View>
            ))}
            {hasMore ? (
              <View className={styles.actionRow}>
                <Button loading={loadingMore} onClick={() => void loadOrders(page + 1, true)}>{loadingMore ? '加载中…' : '加载更多'}</Button>
              </View>
            ) : null}
          </>
        )}
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminCardOrdersPage;
