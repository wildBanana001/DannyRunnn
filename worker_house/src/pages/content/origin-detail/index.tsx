import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { fetchActivities, fetchPosterList, fetchSiteConfig } from '@/cloud/services';
import type { Activity } from '@/types';
import type { Poster, SiteConfig } from '@/types/site';
import styles from './index.module.scss';

const OriginDetailPage: React.FC = () => {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [ongoingActivities, setOngoingActivities] = useState<Activity[]>([]);

  useEffect(() => {
    let isActive = true;

    void Promise.allSettled([fetchPosterList(), fetchSiteConfig(), fetchActivities('ongoing')])
      .then(([posterResult, siteResult, activityResult]) => {
        if (!isActive) return;
        setPosters(posterResult.status === 'fulfilled' ? posterResult.value : []);
        setSiteConfig(siteResult.status === 'fulfilled' ? siteResult.value : null);
        setOngoingActivities(activityResult.status === 'fulfilled' ? activityResult.value : []);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const originImage = useMemo(() => {
    return ongoingActivities[1]?.cover || ongoingActivities[1]?.coverImage || posters[1]?.coverImage || siteConfig?.spaceImage || '';
  }, [ongoingActivities, posters, siteConfig?.spaceImage]);
  const originParagraphs = siteConfig?.spaceDescription?.trim()
    ? [siteConfig.spaceDescription.trim()]
    : [];

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.eyebrow}>起源</Text>
        <Text className={styles.title}>起源 · 我们为什么做这个空间</Text>
        <Text className={styles.description}>把首页原本那段长文本、图片与时间线完整搬到这里，慢慢读也没关系。</Text>
      </View>

      {originImage ? <Image className={styles.cover} src={originImage} mode="aspectFill" /> : null}

      <View className={styles.timelineCard}>
        {originParagraphs.length > 0 ? originParagraphs.map((paragraph, index) => (
          <View key={paragraph} className={styles.timelineItem}>
            <View className={styles.timelineMarker}>
              <Text className={styles.timelineIndex}>{String(index + 1).padStart(2, '0')}</Text>
            </View>
            <View className={styles.timelineBody}>
              <Text className={styles.timelineTitle}>{index === 0 ? '下班后还想被认真接住' : index === originParagraphs.length - 1 ? '继续生长的第二客厅' : `阶段 ${index + 1}`}</Text>
              <Text className={styles.timelineText}>{paragraph}</Text>
            </View>
          </View>
        )) : <Text className={styles.timelineText}>起源内容暂不可用，请稍后再试。</Text>}
      </View>
    </ScrollView>
  );
};

export default OriginDetailPage;
