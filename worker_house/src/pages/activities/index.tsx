import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { fetchActivities } from '@/cloud/services';
import ActivityCard from '@/components/ActivityCard';
import EmptyState from '@/components/EmptyState';
import type { Activity } from '@/types/activity';
import styles from './index.module.scss';

type TabType = 'upcoming' | 'past';
type CategoryType = 'all' | 'life' | 'art' | 'food' | 'outdoor';

const categories: { key: CategoryType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'life', label: '生活美学' },
  { key: 'art', label: '艺术创作' },
  { key: 'food', label: '美食体验' },
  { key: 'outdoor', label: '户外活动' },
];

let cachedUpcomingActivities: Activity[] | null = null;
let cachedPastActivitiesForList: Activity[] | null = null;

const ActivitiesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [upcomingList, setUpcomingList] = useState<Activity[]>(cachedUpcomingActivities ?? []);
  const [pastList, setPastList] = useState<Activity[]>(cachedPastActivitiesForList ?? []);
  const [loading, setLoading] = useState(!cachedUpcomingActivities || !cachedPastActivitiesForList);

  useEffect(() => {
    if (cachedUpcomingActivities && cachedPastActivitiesForList) {
      setUpcomingList(cachedUpcomingActivities);
      setPastList(cachedPastActivitiesForList);
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([fetchActivities('ongoing'), fetchActivities('ended')])
      .then(([ongoing, ended]) => {
        cachedUpcomingActivities = ongoing;
        cachedPastActivitiesForList = ended;
        setUpcomingList(ongoing);
        setPastList(ended);
      })
      .catch(() => {
        setUpcomingList([]);
        setPastList([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredActivities = useMemo(() => {
    const activities = activeTab === 'upcoming' ? upcomingList : pastList;

    if (activeCategory === 'all') {
      return activities;
    }

    const categoryMap: Record<CategoryType, string[]> = {
      all: [],
      life: ['生活美学', '花艺', '咖啡'],
      art: ['手工艺术', '绘画', '陶艺', '摄影'],
      food: ['烘焙', '品酒', '美食'],
      outdoor: ['户外活动', '城市漫步'],
    };

    const targetCategories = categoryMap[activeCategory];
    return activities.filter((activity) =>
      targetCategories.some(
        (cat) => activity.category.includes(cat) || activity.tags.some((tag) => tag.includes(cat)),
      ),
    );
  }, [activeTab, activeCategory, upcomingList, pastList]);

  const handleActivityClick = (activity: Activity) => {
    Taro.navigateTo({
      url: `/pages/content/activity-detail/index?id=${activity.id}`,
    });
  };

  return (
    <View className={styles.container}>
      <View className={styles.tabBar}>
        <View
          className={`${styles.tab} ${activeTab === 'upcoming' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <Text className={`${styles.tabText} ${activeTab === 'upcoming' ? styles.activeTabText : ''}`}>
            即将开始
          </Text>
        </View>
        <View
          className={`${styles.tab} ${activeTab === 'past' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <Text className={`${styles.tabText} ${activeTab === 'past' ? styles.activeTabText : ''}`}>
            往期活动
          </Text>
        </View>
      </View>

      <ScrollView
        className={styles.categoryBar}
        scrollX
        enableFlex
        showScrollbar={false}
      >
        {categories.map((category) => (
          <View
            key={category.key}
            className={`${styles.category} ${activeCategory === category.key ? styles.activeCategory : ''}`}
            onClick={() => setActiveCategory(category.key)}
          >
            <Text
              className={`${styles.categoryText} ${
                activeCategory === category.key ? styles.activeCategoryText : ''
              }`}
            >
              {category.label}
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
            description="正在拉取活动列表..."
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
            description={`该分类下暂时没有${activeTab === 'upcoming' ? '即将开始' : '往期'}活动`}
          />
        )}
        <View className={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

export default ActivitiesPage;
