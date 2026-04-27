import React, { useCallback, useEffect, useState } from 'react';
import { Picker, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Input from '@nutui/nutui-react-taro/dist/es/packages/input/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { fetchAdminCardOrderDetail, updateAdminCardOrder } from '@/services/admin';
import type { CardOrderStatus } from '@/types';
import { formatPrice } from '@/utils/helpers';
import styles from '../shared.module.scss';

const toastId = 'admin-card-order-detail-toast';
const statusOptions: Array<{ label: string; value: CardOrderStatus }> = [
  { label: '生效中', value: 'active' },
  { label: '已耗尽', value: 'exhausted' },
  { label: '已过期', value: 'expired' },
  { label: '已退款', value: 'refunded' },
];

const AdminCardOrderDetailPage: React.FC = () => {
  const router = useRouter();
  const cardOrderId = router.params.id?.trim() || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchAdminCardOrderDetail>> | null>(null);
  const [remainingCount, setRemainingCount] = useState('0');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<CardOrderStatus>('active');

  const statusIndex = Math.max(statusOptions.findIndex((item) => item.value === status), 0);

  const loadDetail = useCallback(async () => {
    if (!cardOrderId) {
      return;
    }
    setLoading(true);
    try {
      const result = await fetchAdminCardOrderDetail(cardOrderId);
      setDetail(result);
      setRemainingCount(String(result.remainingCount));
      setExpiresAt(result.expiresAt || '');
      setStatus(result.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : '次卡详情加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  }, [cardOrderId]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '次卡订单详情' });
    void loadDetail();
  }, [loadDetail]);

  const handleSave = async () => {
    if (!cardOrderId) {
      return;
    }
    setSaving(true);
    try {
      const result = await updateAdminCardOrder(cardOrderId, {
        expiresAt: expiresAt.trim() || undefined,
        reason: reason.trim() || '后台手动调整',
        remainingCount: Number(remainingCount || 0),
        status,
      });
      setDetail(result);
      setReason('');
      Toast.show(toastId, { content: '次卡订单已更新', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '次卡订单更新失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>次卡订单详情</Text>
        <Text className={styles.description}>可直接调整剩余次数、有效期和状态，变更会写入 adjustLogs。</Text>
      </View>

      {loading || !detail ? (
        <View className={styles.listCard}><Text className={styles.emptyText}>{loading ? '详情加载中…' : '未找到次卡订单。'}</Text></View>
      ) : (
        <>
          <View className={styles.detailCard}>
            <Text className={styles.sectionTitle}>{detail.cardType}</Text>
            <Text className={styles.fieldText}>用户：{detail.userNickname || '未命名'} · {detail.userWechatName || '未填写微信号'}</Text>
            <Text className={styles.fieldText}>OpenID：{detail.openid || '未下发'}</Text>
            <Text className={styles.fieldText}>订单金额：{formatPrice(detail.amount)}</Text>
            <Text className={styles.fieldText}>剩余 / 总次数：{detail.remainingCount} / {detail.totalCount}</Text>
            <Text className={styles.fieldText}>有效期：{detail.expiresAt || '未设置'}</Text>
          </View>

          <View className={styles.formCard}>
            <Text className={styles.sectionTitle}>手动调整</Text>
            <View className={styles.filterRow}>
              <View className={styles.inputBlock}>
                <Input value={remainingCount} type="number" placeholder="剩余次数" onChange={setRemainingCount} />
              </View>
              <View className={styles.pickerBlock}>
                <Picker mode="selector" range={statusOptions} rangeKey="label" value={statusIndex} onChange={(event) => setStatus(statusOptions[event.detail.value]?.value || 'active')}>
                  <View className={styles.pickerValue}>{statusOptions[statusIndex]?.label || '生效中'}</View>
                </Picker>
              </View>
            </View>
            <View className={styles.filterRow}>
              <View className={styles.inputBlock}>
                <Input value={expiresAt} placeholder="有效期（ISO 格式，可为空）" onChange={setExpiresAt} />
              </View>
            </View>
            <View className={styles.filterRow}>
              <View className={styles.inputBlock}>
                <Input value={reason} placeholder="调整原因" onChange={setReason} />
              </View>
            </View>
            <View className={styles.actionRow}>
              <Button type="primary" loading={saving} onClick={() => void handleSave()}>{saving ? '保存中…' : '保存调整'}</Button>
              <Button onClick={() => void loadDetail()}>重新拉取</Button>
            </View>
          </View>

          <View className={styles.sectionCard}>
            <Text className={styles.sectionTitle}>使用记录</Text>
            {detail.usageLogs.length > 0 ? detail.usageLogs.map((item) => (
              <View key={item.id} className={styles.logItem}>
                <Text className={styles.itemTitle}>{item.activityTitle}</Text>
                <Text className={styles.itemMeta}>报名记录：{item.registrationId || '无'}</Text>
                <Text className={styles.itemSummary}>{item.usedAt.replace('T', ' ').slice(0, 16)} · 抵扣 {formatPrice(item.deductionAmount)}</Text>
              </View>
            )) : <Text className={styles.emptyText}>暂无使用记录。</Text>}
          </View>

          <View className={styles.sectionCard}>
            <Text className={styles.sectionTitle}>调整日志</Text>
            {detail.adjustLogs?.length ? detail.adjustLogs.map((item) => (
              <View key={`${item.at}-${item.by}`} className={styles.timelineItem}>
                <Text className={styles.itemTitle}>{item.reason || '手动调整'}</Text>
                <Text className={styles.itemMeta}>{item.by} · {item.at.replace('T', ' ').slice(0, 16)}</Text>
                <Text className={styles.itemSummary}>from: {JSON.stringify(item.from)}</Text>
                <Text className={styles.itemSummary}>to: {JSON.stringify(item.to)}</Text>
              </View>
            )) : <Text className={styles.emptyText}>暂无调整日志。</Text>}
          </View>
        </>
      )}

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminCardOrderDetailPage;
