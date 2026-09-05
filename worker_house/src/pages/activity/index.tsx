import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button as TaroButton, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import SafeImage from '@/components/SafeImage';
import activityImageFallback from '@/assets/home/space-room-v2.jpg';
import { fetchActivities } from '@/cloud/services';
import { useEnterAnimation } from '@/hooks/useEnterAnimation';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import type { Activity } from '@/types/activity';
import { formatDate, formatMonthTitle, getProgressPercent, groupActivitiesByMonth } from '@/utils/helpers';
import styles from './index.module.scss';

const ActivityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ongoing' | 'ended'>('ongoing');
  const [ongoingList, setOngoingList] = useState<Activity[]>([]);
  const [endedList, setEndedList] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<'ongoing' | 'ended', boolean>>({
    ongoing: false,
    ended: false,
  });
  const requestIdRef = useRef(0);

  const loadActivities = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const [ongoingResult, endedResult] = await Promise.allSettled([
      fetchActivities('ongoing'),
      fetchActivities('ended'),
    ]);
    if (requestId !== requestIdRef.current) {
      return;
    }

    if (ongoingResult.status === 'fulfilled') {
      setOngoingList(ongoingResult.value);
    }
    if (endedResult.status === 'fulfilled') {
      setEndedList(endedResult.value);
    }
    setErrors({
      ongoing: ongoingResult.status === 'rejected',
      ended: endedResult.status === 'rejected',
    });
    setLoading(false);
  }, []);

  useDidShow(() => {
    void loadActivities();
  });

  const endedSections = useMemo(() => groupActivitiesByMonth(endedList), [endedList]);
  const { style: enterStyle } = useEnterAnimation();
  const viewportStyle = useViewportLayout({ fallbackTopGapRpx: 50, reserveH5TabBar: true });

  const handleOpenDetail = (activity: Activity) => {
    Taro.navigateTo({ url: `/pages/content/activity-detail/index?id=${activity.id}` });
  };

  return (
    <ScrollView className={styles.container} style={viewportStyle} scrollY enableFlex>
      <View className={styles.pageIntro}>
        <Text className={styles.eyebrow}>WORKER HOUSE EVENTS</Text>
        <Text className={styles.pageTitle}>社畜活动</Text>
        <Text className={styles.pageSubtitle}>见面，比点赞更有意思。</Text>
      </View>
      <View className={styles.segmentWrap}>
        <View className={styles.segmentBar}>
          <View
            className={styles.segmentIndicator}
            style={{ transform: activeTab === 'ongoing' ? 'translateX(0)' : 'translateX(100%)' }}
          />
          <TaroButton
            className={`${styles.segmentItem} ${activeTab === 'ongoing' ? styles.segmentItemActive : ''}`}
            ariaLabel="查看进行中活动"
            onClick={() => setActiveTab('ongoing')}
          >
            <Text
              className={`${styles.segmentText} ${
                activeTab === 'ongoing' ? styles.segmentTextActive : ''
              }`}
            >
              进行中
            </Text>
          </TaroButton>
          <TaroButton
            className={`${styles.segmentItem} ${activeTab === 'ended' ? styles.segmentItemActive : ''}`}
            ariaLabel="查看已结束活动"
            onClick={() => setActiveTab('ended')}
          >
            <Text
              className={`${styles.segmentText} ${
                activeTab === 'ended' ? styles.segmentTextActive : ''
              }`}
            >
              已结束
            </Text>
          </TaroButton>
        </View>
      </View>

      {loading ? (
        <View className={styles.loadingWrap}>
          <Text className={styles.loadingText}>活动加载中...</Text>
        </View>
      ) : errors[activeTab] ? (
        <EmptyState title="活动加载失败" description="网络似乎开了小差，请稍后再试。">
          <Button block type="outline" onClick={() => void loadActivities()}>重新加载</Button>
        </EmptyState>
      ) : activeTab === 'ongoing' ? (
        ongoingList.length > 0 ? (
          <View className={styles.ongoingList} style={enterStyle}>
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
                  <SafeImage
                    className={styles.ongoingCover}
                    src={activity.coverImage}
                    fallbackSrc={activityImageFallback}
                    mode="aspectFill"
                    fallbackDelayMs={2200}
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
          <EmptyState title="近期活动筹备中" description="新活动正在路上，晚点再来看看吧。" />
        )
      ) : (
        endedSections.length > 0 ? (
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
                    <SafeImage
                      className={styles.endedThumb}
                      src={activity.coverImage}
                      fallbackSrc={activityImageFallback}
                      mode="aspectFill"
                      fallbackDelayMs={2200}
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
        ) : (
          <EmptyState title="还没有往期活动" description="第一段活动回忆，很快会在这里出现。" />
        )
      )}

      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default ActivityPage;
