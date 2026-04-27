import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { fetchActivities } from '@/cloud/services';
import { useUserStore } from '@/store/userStore';
import type { Activity } from '@/types/activity';
import { formatDate, formatMonthTitle, getProgressPercent, groupActivitiesByMonth } from '@/utils/helpers';
import styles from './index.module.scss';

const ActivityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ongoing' | 'ended'>('ongoing');
  const [ongoingList, setOngoingList] = useState<Activity[]>([]);
  const [endedList, setEndedList] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    if (!useUserStore.getState().isLoggedIn) {
      Taro.switchTab({ url: '/pages/home/index' });
      return;
    }
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchActivities('ongoing'), fetchActivities('ended')])
      .then(([ongoing, ended]) => {
        if (cancelled) return;
        setOngoingList(ongoing);
        setEndedList(ended);
      })
      .catch(() => {
        if (cancelled) return;
        setOngoingList([]);
        setEndedList([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const endedSections = useMemo(() => groupActivitiesByMonth(endedList), [endedList]);

  const handleOpenDetail = (activity: Activity) => {
    Taro.navigateTo({ url: `/pages/content/activity-detail/index?id=${activity.id}` });
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.segmentWrap}>
        <View className={styles.segmentBar}>
          <View
            className={`${styles.segmentItem} ${activeTab === 'ongoing' ? styles.segmentItemActive : ''}`}
            onClick={() => setActiveTab('ongoing')}
          >
            <Text
              className={`${styles.segmentText} ${
                activeTab === 'ongoing' ? styles.segmentTextActive : ''
              }`}
            >
              进行中
            </Text>
          </View>
          <View
            className={`${styles.segmentItem} ${activeTab === 'ended' ? styles.segmentItemActive : ''}`}
            onClick={() => setActiveTab('ended')}
          >
            <Text
              className={`${styles.segmentText} ${
                activeTab === 'ended' ? styles.segmentTextActive : ''
              }`}
            >
              已结束
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className={styles.loadingWrap}>
          <Text className={styles.loadingText}>活动加载中...</Text>
        </View>
      ) : activeTab === 'ongoing' ? (
        <View className={styles.ongoingList}>
          {ongoingList.map((activity) => {
            const progress = getProgressPercent(
              activity.currentParticipants,
              activity.maxParticipants,
            );
            return (
              <View
                key={activity.id}
                className={styles.ongoingCard}
                onClick={() => handleOpenDetail(activity)}
              >
                <View className={styles.coverWrap}>
                  <Image
                    className={styles.ongoingCover}
                    src={activity.coverImage}
                    mode="aspectFill"
                  />
                </View>
                <View className={styles.ongoingBody}>
                  <View className={styles.metaRow}>
                    <Text className={styles.metaText}>{formatDate(activity.startDate)}</Text>
                  </View>
                  <Text className={styles.ongoingTitle}>{activity.title}</Text>
                  <Text className={styles.progressText}>
                    报名进度 {activity.currentParticipants}/{activity.maxParticipants}
                  </Text>
                  <View className={styles.progressTrack}>
                    <View
                      className={styles.progressFill}
                      style={{ width: `${progress}%` }}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View className={styles.endedList}>
          {endedSections.map((section) => (
            <View key={section.month} className={styles.sectionBlock}>
              <View className={styles.stickyHeader}>
                <Text className={styles.stickyTitle}>
                  {formatMonthTitle(section.items[0].startDate)}
                </Text>
              </View>
              {section.items.map((activity) => (
                <View
                  key={activity.id}
                  className={styles.endedItem}
                  onClick={() => handleOpenDetail(activity)}
                >
                  <View className={styles.endedThumbWrap}>
                    <Image
                      className={styles.endedThumb}
                      src={activity.coverImage}
                      mode="aspectFill"
                    />
                  </View>
                  <View className={styles.endedInfo}>
                    <Text className={styles.endedDate}>
                      {formatDate(activity.startDate)}
                    </Text>
                    <Text className={styles.endedTitle}>{activity.title}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default ActivityPage;
