import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import { fetchRegistrationDetail } from '@/services/member';
import type { Registration } from '@/types';
import { formatDate, formatDateTime, formatPrice, getRegistrationStatusColor, getRegistrationStatusText } from '@/utils/helpers';
import { formatProfileGender } from '@/utils/profile';
import styles from './index.module.scss';

const RegistrationDetailPage: React.FC = () => {
  const router = useRouter();
  const [detail, setDetail] = useState<Registration | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { id } = router.params;
    if (!id) {
      setDetail(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchRegistrationDetail(id)
      .then((result) => setDetail(result))
      .catch((error) => {
        console.warn('[registration-detail] load failed', error);
        setDetail(null);
      })
      .finally(() => setIsLoading(false));
  }, [router.params]);

  if (isLoading) {
    return (
      <View className={styles.emptyWrap}>
        <EmptyState title="正在加载报名详情" description="稍等一下，我们正在同步你的报名信息。" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className={styles.emptyWrap}>
        <EmptyState title="没找到这条报名记录" description="可能已经被删除，或者你是从旧链接点进来的。" />
      </View>
    );
  }

  const activity = detail.activity ?? null;
  const profile = detail.profileSnapshot;
  const statusColor = getRegistrationStatusColor(detail.status);
  const activityCover = activity?.cover || activity?.coverImage || detail.activityCover;
  const activityMeta = activity ? `${formatDate(activity.startDate)}` : '活动信息加载失败';

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.heroCard}>
        <Image className={styles.cover} src={activityCover} mode="aspectFill" />
        <View className={styles.heroBody}>
          <View className={styles.statusBadge} style={{ color: statusColor, backgroundColor: `${statusColor}18` }}>
            <Text>{getRegistrationStatusText(detail.status)}</Text>
          </View>
          <Text className={styles.title}>{detail.activityTitle}</Text>
          <Text className={styles.meta}>{activityMeta}</Text>
          <Text className={styles.meta}>报名时间 {formatDateTime(detail.registeredAt)}</Text>
        </View>
      </View>

      <View className={styles.sectionCard}>
        <Text className={styles.sectionTitle}>支付信息</Text>
        <View className={styles.row}><Text className={styles.label}>原价</Text><Text className={styles.value}>{formatPrice(detail.originalPrice)}</Text></View>
        <View className={styles.row}><Text className={styles.label}>次卡抵扣</Text><Text className={styles.discountValue}>- {formatPrice(detail.cardOffset)}</Text></View>
        <View className={styles.row}><Text className={styles.label}>实付</Text><Text className={styles.strongValue}>{formatPrice(detail.amountPaid)}</Text></View>
        <View className={styles.row}><Text className={styles.label}>应付金额</Text><Text className={styles.value}>{formatPrice(detail.payable)}</Text></View>
      </View>

      <View className={styles.sectionCard}>
        <Text className={styles.sectionTitle}>档案快照</Text>
        <Text className={styles.snapshotLine}>档案昵称：{detail.participantNickname || profile?.nickname || '未填写'}</Text>
        <Text className={styles.snapshotLine}>微信名：{detail.wechatName || '未填写'}</Text>
        <Text className={styles.snapshotLine}>电话：{detail.phone || '未填写'}</Text>
        <Text className={styles.snapshotLine}>性别：{formatProfileGender(profile?.gender)}</Text>
        <Text className={styles.snapshotLine}>年龄段：{profile?.ageRange || '未填写'}</Text>
        <Text className={styles.snapshotLine}>职业 / 身份：{profile?.occupation || profile?.industry || '未填写'}</Text>
        <Text className={styles.snapshotLine}>所在城市：{profile?.city || '未填写'}</Text>
        <Text className={styles.snapshotLine}>社交目标：{profile?.socialGoal || '未填写'}</Text>
        <Text className={styles.snapshotLine}>介绍：{profile?.introduction || '未填写'}</Text>
      </View>

      <View className={styles.actionWrap}>
        <Button type="outline" size="large" block onClick={() => Taro.navigateTo({ url: `/pages/content/activity-detail/index?id=${detail.activityId}` })}>
          去看活动详情
        </Button>
      </View>

      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default RegistrationDetailPage;
