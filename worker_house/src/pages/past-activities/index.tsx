import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { fetchActivities } from '@/cloud/services';
import ActivityCard from '@/components/ActivityCard';
import EmptyState from '@/components/EmptyState';
import type { Activity } from '@/types/activity';
import styles from './index.module.scss';

type FilterType = 'all' | '2026' | '2025' | 'art' | 'life' | 'food';

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '2026', label: '2026年' },
  { key: '2025', label: '2025年' },
  { key: 'art', label: '艺术' },
  { key: 'life', label: '生活' },
  { key: 'food', label: '美食' },
];

let cachedPastActivities: Activity[] | null = null;

const PastActivitiesPage: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activities, setActivities] = useState<Activity[]>(cachedPastActivities ?? []);
  const [loading, setLoading] = useState(!cachedPastActivities);
  const [error, setError] = useState<string | null>(null);

  useLoad(() => {
    if (cachedPastActivities && cachedPastActivities.length > 0) {
      setActivities(cachedPastActivities);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchActivities('ended')
      .then((list) => {
        cachedPastActivities = list;
        setActivities(list);
      })
      .catch(() => {
        setError('加载历史活动失败，请稍后重试');
        setActivities([]);
      })
      .finally(() => {
        setLoading(false);
      });
  });

  const filteredActivities = useMemo(() => {
    const baseList = [...activities];

    baseList.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    if (activeFilter === 'all') {
      return baseList;
    }

    if (activeFilter === '2026' || activeFilter === '2025') {
      return baseList.filter((activity) => activity.startDate.startsWith(activeFilter));
    }

    const categoryMap: Record<string, string[]> = {
      art: ['手工艺术', '绘画', '陶艺', '摄影', '花艺'],
      life: ['生活美学', '咖啡'],
      food: ['烘焙', '品酒', '美食'],
    };

    const targetCategories = categoryMap[activeFilter] || [];
    return baseList.filter((activity) =>
      targetCategories.some(
        (cat) => activity.category.includes(cat) || activity.tags.some((tag) => tag.includes(cat)),
      ),
    );
  }, [activities, activeFilter]);

  const handleActivityClick = (activity: Activity) => {
    Taro.navigateTo({
      url: `/pages/content/activity-detail/index?id=${activity.id}`,
    });
  };

  return (
    <View className={styles.container}>
      <ScrollView
        className={styles.filterBar}
        scrollX
        enableFlex
        showScrollbar={false}
      >
        {filters.map((filter) => (
          <View
            key={filter.key}
            className={`${styles.filter} ${activeFilter === filter.key ? styles.activeFilter : ''}`}
            onClick={() => setActiveFilter(filter.key)}
          >
            <Text
              className={`${styles.filterText} ${
                activeFilter === filter.key ? styles.activeFilterText : ''
              }`}
            >
              {filter.label}
            </Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView
        className={styles.activityList}
        scrollY
        enableFlex
      >
        {loading ? (
          <EmptyState
            title="加载中"
            description="正在拉取往期活动..."
          />
        ) : filteredActivities.length > 0 ? (
          filteredActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              className={styles.activityCard}
              onClick={handleActivityClick}
            />
          ))
        ) : (
          <EmptyState
            title="暂无活动"
            description={error || '该筛选条件下暂时没有往期活动'}
          />
        )}
        <View className={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

export default PastActivitiesPage;
