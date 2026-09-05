import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { fetchPosterDetail } from '@/cloud/services';
import type { Poster } from '@/types/site';
import styles from './index.module.scss';

const PosterDetailPage: React.FC = () => {
  const router = useRouter();
  const posterId = router.params.id?.trim() || '';
  const [poster, setPoster] = useState<Poster | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    if (!posterId) {
      setPoster(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchPosterDetail(posterId)
      .then((detail) => {
        if (isActive) setPoster(detail?.id === posterId ? detail : null);
      })
      .catch(() => {
        if (isActive) setPoster(null);
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [posterId]);

  if (loading) {
    return (
      <View className={styles.emptyWrap}>
        <Text className={styles.emptyText}>海报加载中...</Text>
      </View>
    );
  }

  if (!poster) {
    return (
      <View className={styles.emptyWrap}>
        <Text className={styles.emptyText}>暂时没有海报内容</Text>
      </View>
    );
  }

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <Image className={styles.cover} src={poster.coverImage} mode="aspectFill" />
      <View className={styles.content}>
        <Text className={styles.title}>{poster.title}</Text>
        <Text className={styles.subtitle}>点击图片可长按保存或分享给朋友</Text>
        {poster.detailImages.map((image) => (
          <Image
            key={image}
            className={styles.detailImage}
            src={image}
            mode="widthFix"
            onClick={() => Taro.previewImage({ current: image, urls: poster.detailImages })}
          />
        ))}
      </View>
    </ScrollView>
  );
};

export default PosterDetailPage;
