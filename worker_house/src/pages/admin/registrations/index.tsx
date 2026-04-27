import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Picker, ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Input from '@nutui/nutui-react-taro/dist/es/packages/input/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { fetchAdminActivities, fetchAdminRegistrations } from '@/services/admin';
import type { Activity, Registration, RegistrationStatus } from '@/types';
import styles from '../shared.module.scss';

const toastId = 'admin-registrations-toast';
const pageSize = 20;
const statusOptions: Array<{ label: string; value: RegistrationStatus | '' }> = [
  { label: '全部状态', value: '' },
  { label: '待确认', value: 'pending' },
  { label: '已确认', value: 'confirmed' },
  { label: '已取消', value: 'cancelled' },
  { label: '已完成', value: 'completed' },
  { label: '已退款', value: 'refunded' },
];

const statusTextMap: Record<string, string> = {
  cancelled: '已取消',
  completed: '已完成',
  confirmed: '已确认',
  pending: '待确认',
  refunded: '已退款',
};

const statusClassMap: Record<string, string> = {
  cancelled: styles.statusCancelled,
  completed: styles.statusCompleted,
  confirmed: styles.statusConfirmed,
  pending: styles.statusPending,
  refunded: styles.statusRefunded,
};

const AdminRegistrationsPage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [records, setRecords] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activityId, setActivityId] = useState('');
  const [status, setStatus] = useState<RegistrationStatus | ''>('');
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const activityOptions = useMemo(() => [{ label: '全部活动', value: '' }, ...activities.map((item) => ({ label: item.title, value: item.id }))], [activities]);
  const activityIndex = Math.max(activityOptions.findIndex((item) => item.value === activityId), 0);
  const statusIndex = Math.max(statusOptions.findIndex((item) => item.value === status), 0);

  const loadRegistrations = useCallback(async (nextPage = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const [activityResult, registrationResult] = await Promise.all([
        fetchAdminActivities(1, 200),
        fetchAdminRegistrations({ activityId, keyword, page: nextPage, pageSize, status: status || undefined }),
      ]);
      setActivities(activityResult.list);
      setTotal(registrationResult.total);
      setPage(nextPage);
      setRecords((current) => append ? [...current, ...registrationResult.list] : registrationResult.list);
    } catch (error) {
      const message = error instanceof Error ? error.message : '报名列表加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activityId, keyword, status]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '报名管理' });
  }, []);

  useEffect(() => {
    void loadRegistrations(1, false);
  }, [loadRegistrations]);

  const hasMore = records.length < total;

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>报名管理</Text>
        <Text className={styles.description}>支持按活动、状态和关键词筛选报名记录，点击详情后可直接切换状态。</Text>
      </View>

      <View className={styles.filtersCard}>
        <View className={styles.filterRow}>
          <View className={styles.pickerBlock}>
            <Picker mode="selector" range={activityOptions} rangeKey="label" value={activityIndex} onChange={(event) => setActivityId(activityOptions[event.detail.value]?.value || '')}>
              <View className={styles.pickerValue}>{activityOptions[activityIndex]?.label || '全部活动'}</View>
            </Picker>
          </View>
          <View className={styles.pickerBlock}>
            <Picker mode="selector" range={statusOptions} rangeKey="label" value={statusIndex} onChange={(event) => setStatus(statusOptions[event.detail.value]?.value || '')}>
              <View className={styles.pickerValue}>{statusOptions[statusIndex]?.label || '全部状态'}</View>
            </Picker>
          </View>
        </View>
        <View className={styles.filterRow}>
          <View className={styles.inputBlock}>
            <Input value={keywordInput} placeholder="搜索昵称 / 微信号 / 手机号" onChange={setKeywordInput} />
          </View>
        </View>
        <View className={styles.actionRow}>
          <Button type="primary" onClick={() => setKeyword(keywordInput.trim())}>搜索</Button>
          <Button onClick={() => { setKeywordInput(''); setKeyword(''); setActivityId(''); setStatus(''); }}>重置</Button>
          <Button onClick={() => void loadRegistrations(1, false)}>{loading ? '刷新中…' : '刷新列表'}</Button>
        </View>
      </View>

      <View className={styles.listCard}>
        {loading ? (
          <Text className={styles.emptyText}>报名列表加载中…</Text>
        ) : records.length === 0 ? (
          <Text className={styles.emptyText}>暂无匹配记录。</Text>
        ) : (
          <>
            {records.map((item) => (
              <View key={item.id} className={styles.itemBlock}>
                <View className={styles.statusRow}>
                  <Text className={styles.itemTitle}>{item.participantNickname || '未命名报名'}</Text>
                  <Text className={`${styles.statusPill} ${statusClassMap[item.status] || styles.statusPending}`}>{statusTextMap[item.status] || item.status}</Text>
                </View>
                <Text className={styles.itemMeta}>{item.activitySnapshot?.title || item.activityTitle}</Text>
                <Text className={styles.itemSummary}>微信号：{item.wechatName || '未填写'} · 手机：{item.phone || '未填写'}</Text>
                <Text className={styles.itemSummary}>报名时间：{(item.createdAt || item.registeredAt || '').replace('T', ' ').slice(0, 16)}</Text>
                <View className={styles.itemActions}>
                  <Button type="primary" onClick={() => Taro.navigateTo({ url: `/pages/admin/registration-detail/index?id=${item.id}` })}>查看详情</Button>
                </View>
              </View>
            ))}
            {hasMore ? (
              <View className={styles.actionRow}>
                <Button loading={loadingMore} onClick={() => void loadRegistrations(page + 1, true)}>{loadingMore ? '加载中…' : '加载更多'}</Button>
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

export default AdminRegistrationsPage;
