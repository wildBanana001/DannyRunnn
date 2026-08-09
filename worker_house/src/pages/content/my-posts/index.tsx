import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import CommunityWallUnavailable from '@/components/CommunityWallUnavailable';
import EmptyState from '@/components/EmptyState';
import { fetchMyPosts } from '@/services/post';
import { useCommunityWallFeature } from '@/shared/siteConfig';
import type { Post } from '@/types/post';
import { formatDateTime, getPostCommentCount, getPostExcerpt } from '@/utils/helpers';
import styles from './index.module.scss';

const MyPostsPage: React.FC = () => {
  const wallFeature = useCommunityWallFeature();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const loadingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const list = await fetchMyPosts();
      setPosts(list);
    } catch (error) {
      console.warn('[my-posts] load failed', error);
      setErrorMessage('帖子加载失败，请稍后重试');
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useDidShow(() => {
    if (wallFeature.enabled) {
      void loadData();
    }
  });

  useEffect(() => {
    if (!wallFeature.loading && wallFeature.enabled && isLoading && posts.length === 0) {
      void loadData();
    }
  }, [isLoading, loadData, posts.length, wallFeature.enabled, wallFeature.loading]);

  if (wallFeature.loading || !wallFeature.enabled) {
    return <CommunityWallUnavailable loading={wallFeature.loading} />;
  }

  if (isLoading && posts.length === 0) {
    return (
      <View className={styles.container}>
        <View className={styles.bottomSpacing}>
          <Text className={styles.meta}>正在加载你的帖子...</Text>
        </View>
      </View>
    );
  }

  if (errorMessage && posts.length === 0) {
    return (
      <View className={styles.container}>
        <EmptyState title="加载失败" description={errorMessage} />
      </View>
    );
  }

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      {posts.length > 0 ? (
        <View className={styles.list}>
          {posts.map((post) => (
            <View key={post.id} className={styles.card} onClick={() => Taro.navigateTo({ url: `/pages/post-detail/index?id=${post.id}` })}>
              <Text className={styles.title}>{post.title}</Text>
              <Text className={styles.summary}>{getPostExcerpt(post.content, 70)}</Text>
              <View className={styles.tags}>
                {post.tags.map((tag) => (
                  <View key={tag} className={styles.tagChip}>
                    <Text className={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
              <View className={styles.footer}>
                <Text className={styles.meta}>{formatDateTime(post.createdAt)}</Text>
                <Text className={styles.meta}>❤️ {post.likes} · 💬 {getPostCommentCount(post)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="还没有发布过帖子" description="去留言墙写下第一条心情，让更多人看见你的故事。" />
      )}
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default MyPostsPage;
