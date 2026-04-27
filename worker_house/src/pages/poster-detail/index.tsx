import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { fetchPosterDetail } from '@/cloud/services';
import { posters } from '@/data/posters';
import type { Poster } from '@/types/site';
import styles from './index.module.scss';

const PosterDetailPage: React.FC = () => {
  const router = useRouter();
  const [poster, setPoster] = useState<Poster | null>(posters[0] ?? null);

  useEffect(() => {
    const { id } = router.params;
    if (!id) {
      setPoster(posters[0] ?? null);
      return;
    }

    fetchPosterDetail(id)
      .then((detail) => setPoster(detail))
      .catch(() => setPoster(posters.find((item) => item.id === id) ?? posters[0] ?? null));
  }, [router.params]);

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
        <Text className={`${styles.title} font-display`}>{poster.title}</Text>
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
