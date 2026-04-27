import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { fetchActivities, fetchPosterList, fetchSiteConfig } from '@/cloud/services';
import { ongoingActivities as activityFallback } from '@/data/activities';
import { homeLandingConfig, siteConfig as siteFallback, type HomeLandingConfig } from '@/data/site';
import { posters as posterFallback } from '@/data/posters';
import type { Activity } from '@/types';
import type { SiteConfig } from '@/types/site';
import styles from './index.module.scss';

const mergeSiteConfig = (site: SiteConfig): HomeLandingConfig => ({
  ...homeLandingConfig,
  ...site,
});

const OriginDetailPage: React.FC = () => {
  const [posters, setPosters] = useState(posterFallback);
  const [siteConfig, setSiteConfig] = useState<HomeLandingConfig>(mergeSiteConfig(siteFallback));
  const [ongoingActivities, setOngoingActivities] = useState<Activity[]>(activityFallback);

  useEffect(() => {
    Promise.all([fetchPosterList(), fetchSiteConfig(), fetchActivities('ongoing')])
      .then(([posterList, site, activities]) => {
        setPosters(posterList.length > 0 ? posterList : posterFallback);
        setSiteConfig(mergeSiteConfig(site));
        setOngoingActivities(activities.length > 0 ? activities : activityFallback);
      })
      .catch(() => {
        setPosters(posterFallback);
        setSiteConfig(mergeSiteConfig(siteFallback));
        setOngoingActivities(activityFallback);
      });
  }, []);

  const originImage = useMemo(() => {
    return ongoingActivities[1]?.cover || ongoingActivities[1]?.coverImage || posters[1]?.coverImage || siteConfig.spaceImage;
  }, [ongoingActivities, posters, siteConfig.spaceImage]);

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.eyebrow}>起源</Text>
        <Text className={styles.title}>起源 · 我们为什么做这个空间</Text>
        <Text className={styles.description}>把首页原本那段长文本、图片与时间线完整搬到这里，慢慢读也没关系。</Text>
      </View>

      <Image className={styles.cover} src={originImage} mode="aspectFill" />

      <View className={styles.timelineCard}>
        {siteConfig.originParagraphs.map((paragraph, index) => (
          <View key={paragraph} className={styles.timelineItem}>
            <View className={styles.timelineMarker}>
              <Text className={styles.timelineIndex}>{String(index + 1).padStart(2, '0')}</Text>
            </View>
            <View className={styles.timelineBody}>
              <Text className={styles.timelineTitle}>{index === 0 ? '下班后还想被认真接住' : index === siteConfig.originParagraphs.length - 1 ? '继续生长的第二客厅' : `阶段 ${index + 1}`}</Text>
              <Text className={styles.timelineText}>{paragraph}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

export default OriginDetailPage;
