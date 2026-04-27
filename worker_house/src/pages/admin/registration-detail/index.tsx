import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { fetchAdminRegistrationDetail, updateAdminRegistrationStatus } from '@/services/admin';
import type { RegistrationStatus } from '@/types';
import { formatPrice } from '@/utils/helpers';
import styles from '../shared.module.scss';

const toastId = 'admin-registration-detail-toast';
const statusTextMap: Record<string, string> = {
  cancelled: '已取消',
  completed: '已完成',
  confirmed: '已确认',
  pending: '待确认',
  refunded: '已退款',
};

const statusButtonList: Array<{ label: string; value: RegistrationStatus }> = [
  { label: '确认报名', value: 'confirmed' },
  { label: '标记取消', value: 'cancelled' },
  { label: '标记退款', value: 'refunded' },
];

const AdminRegistrationDetailPage: React.FC = () => {
  const router = useRouter();
  const registrationId = router.params.id?.trim() || '';
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<RegistrationStatus | ''>('');
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchAdminRegistrationDetail>> | null>(null);

  const loadDetail = useCallback(async () => {
    if (!registrationId) {
      return;
    }
    setLoading(true);
    try {
      const result = await fetchAdminRegistrationDetail(registrationId);
      setDetail(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '报名详情加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '报名详情' });
    void loadDetail();
  }, [loadDetail]);

  const activityTitle = useMemo(() => detail?.activitySnapshot?.title || detail?.activityTitle || '未命名活动', [detail]);

  const handleUpdateStatus = async (status: RegistrationStatus) => {
    if (!registrationId) {
      return;
    }
    setUpdating(status);
    try {
      const result = await updateAdminRegistrationStatus(registrationId, status);
      setDetail(result);
      Toast.show(toastId, { content: '状态已更新', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '状态更新失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setUpdating('');
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>报名详情</Text>
        <Text className={styles.description}>查看活动快照、档案快照与价格拆解，并支持直接改状态。</Text>
      </View>

      {loading || !detail ? (
        <View className={styles.listCard}><Text className={styles.emptyText}>{loading ? '详情加载中…' : '未找到报名记录。'}</Text></View>
      ) : (
        <>
          <View className={styles.detailCard}>
            <Text className={styles.sectionTitle}>{activityTitle}</Text>
            <Text className={styles.fieldText}>当前状态：{statusTextMap[detail.status] || detail.status}</Text>
            <Text className={styles.fieldText}>报名时间：{(detail.createdAt || detail.registeredAt || '').replace('T', ' ').slice(0, 16)}</Text>
            <Text className={styles.fieldText}>次卡订单：{detail.cardOrderId || '未使用'}</Text>
            <Text className={styles.fieldText}>次卡流水：{detail.cardUsageLogId || '未使用'}</Text>
          </View>

          <View className={styles.sectionCard}>
            <Text className={styles.sectionTitle}>价格拆解</Text>
            <Text className={styles.fieldText}>原价：{formatPrice(detail.priceBreakdown?.originalPrice ?? detail.originalPrice)}</Text>
            <Text className={styles.fieldText}>次卡抵扣：- {formatPrice(detail.priceBreakdown?.cardOffset ?? detail.cardOffset)}</Text>
            <Text className={styles.fieldText}>应付金额：{formatPrice(detail.priceBreakdown?.payable ?? detail.payable)}</Text>
            <Text className={styles.fieldText}>实付：{formatPrice(detail.priceBreakdown?.amountPaid ?? detail.amountPaid)}</Text>
          </View>

          <View className={styles.sectionCard}>
            <Text className={styles.sectionTitle}>档案快照</Text>
            <Text className={styles.fieldText}>昵称：{detail.profileSnapshot.nickname || '未填写'}</Text>
            <Text className={styles.fieldText}>微信名：{detail.wechatName || '未填写'}</Text>
            <Text className={styles.fieldText}>手机号：{detail.phone || '未填写'}</Text>
            <Text className={styles.fieldText}>年龄段：{detail.profileSnapshot.ageRange || '未填写'}</Text>
            <Text className={styles.fieldText}>行业：{detail.profileSnapshot.industry || '未填写'}</Text>
            <Text className={styles.fieldText}>职业：{detail.profileSnapshot.occupation || '未填写'}</Text>
            <Text className={styles.fieldText}>城市：{detail.profileSnapshot.city || '未填写'}</Text>
            <Text className={styles.fieldText}>社交目标：{detail.profileSnapshot.socialGoal || '未填写'}</Text>
            <Text className={styles.fieldText}>自我介绍：{detail.profileSnapshot.introduction || '未填写'}</Text>
          </View>

          <View className={styles.actionCard}>
            <Text className={styles.sectionTitle}>切换状态</Text>
            <View className={styles.actionRow}>
              {statusButtonList.map((item) => (
                <Button key={item.value} type={item.value === 'confirmed' ? 'primary' : 'default'} loading={updating === item.value} onClick={() => void handleUpdateStatus(item.value)}>
                  {item.label}
                </Button>
              ))}
            </View>
          </View>
        </>
      )}

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminRegistrationDetailPage;
