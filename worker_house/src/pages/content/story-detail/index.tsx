import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import { fetchStoryDetail } from '@/services/stories';
import type { Story } from '@/types';
import { formatDate } from '@/utils/helpers';
import styles from './index.module.scss';

const StoryDetailPage: React.FC = () => {
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storyId = router.params.id?.trim() || '';
    if (!storyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchStoryDetail(storyId)
      .then((detail) => setStory(detail))
      .catch(() => {
        setStory(null);
        Taro.showToast({ title: '故事加载失败', icon: 'none' });
      })
      .finally(() => setLoading(false));
  }, [router.params.id]);

  const paragraphs = useMemo(() => {
    if (!story?.content) {
      return [];
    }
    return story.content
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);
  }, [story?.content]);

  const handleOpenSource = async () => {
    if (!story?.sourceUrl) {
      return;
    }

    await Taro.setClipboardData({ data: story.sourceUrl });
    Taro.showToast({ title: '原文链接已复制', icon: 'success' });
  };

  if (loading) {
    return (
      <View className={styles.emptyWrap}>
        <Text className={styles.emptyText}>故事加载中...</Text>
      </View>
    );
  }

  if (!story) {
    return (
      <View className={styles.emptyWrap}>
        <Text className={styles.emptyText}>故事正在酝酿中...</Text>
      </View>
    );
  }

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <Image className={styles.cover} src={story.cover} mode="aspectFill" />
      <View className={styles.contentCard}>
        <Text className={styles.title}>{story.title}</Text>
        <View className={styles.metaRow}>
          <Text className={styles.metaText}>{story.author || '社畜空间'}</Text>
          <Text className={styles.metaDot}>·</Text>
          <Text className={styles.metaText}>{formatDate(story.publishAt)}</Text>
        </View>
        {story.excerpt ? <Text className={styles.excerpt}>{story.excerpt}</Text> : null}
        <View className={styles.body}>
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph) => (
              <Text key={paragraph} className={styles.paragraph}>{paragraph}</Text>
            ))
          ) : (
            <Text className={styles.paragraph}>故事正文还在整理中，晚点再来看看。</Text>
          )}
        </View>
        {story.sourceUrl ? (
          <View className={styles.footerAction}>
            <Button type="primary" size="large" block onClick={() => void handleOpenSource()}>
              查看原文
            </Button>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
};

export default StoryDetailPage;
