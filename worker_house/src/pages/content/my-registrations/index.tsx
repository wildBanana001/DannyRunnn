import React, { useCallback, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import EmptyState from '@/components/EmptyState';
import { fetchRegistrations } from '@/services/member';
import type { Registration } from '@/types';
import { formatDate, formatDateTime, getRegistrationStatusColor, getRegistrationStatusText } from '@/utils/helpers';
import styles from './index.module.scss';

const MyRegistrationsPage: React.FC = () => {
  const router = useRouter();
  const highlightId = router.params.highlight?.trim() || '';
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const list = await fetchRegistrations();
      setRegistrations(list);
    } catch (error) {
      console.warn('[my-registrations] load failed', error);
      setErrorMessage('报名记录加载失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  if (isLoading && registrations.length === 0) {
    return (
      <View className={styles.container}>
        <View className={styles.bottomSpacing}>
          <Text className={styles.meta}>正在加载报名记录...</Text>
        </View>
      </View>
    );
  }

  if (errorMessage && registrations.length === 0) {
    return (
      <View className={styles.container}>
        <EmptyState title="加载失败" description={errorMessage} />
      </View>
    );
  }

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      {registrations.length > 0 ? (
        <View className={styles.list}>
          {registrations.map((registration) => {
            const activity = registration.activity;
            const statusColor = getRegistrationStatusColor(registration.status);
            return (
              <View
                key={registration.id}
                className={highlightId === registration.id ? styles.cardHighlight : styles.card}
                onClick={() => Taro.navigateTo({ url: `/pages/content/registration-detail/index?id=${registration.id}` })}
              >
                <View className={styles.coverWrap}>
                  <Image className={styles.cover} src={activity?.cover || activity?.coverImage || registration.activityCover} mode="aspectFill" />
                </View>
                <View className={styles.body}>
                  <View className={styles.statusBadge} style={{ color: statusColor, backgroundColor: `${statusColor}1A` }}>
                    <Text>{getRegistrationStatusText(registration.status)}</Text>
                  </View>
                  <Text className={styles.title}>{registration.activityTitle}</Text>
                  <Text className={styles.meta}>{activity ? `${formatDate(activity.startDate)}` : '活动信息加载失败'}</Text>
                  <Text className={styles.meta}>报名时间 {formatDateTime(registration.registeredAt)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState title="还没有报名记录" description="看到喜欢的活动先记下来，想好了再来报名也不迟。" />
      )}
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default MyRegistrationsPage;
