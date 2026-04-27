import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import { fetchActivityDetail } from '@/cloud/services';
import { featuredActivity } from '@/data/activities';
import type { Activity } from '@/types';
import { formatDate, formatPrice, getActivityStatusText } from '@/utils/helpers';
import styles from './index.module.scss';

const ActivityDetailPage: React.FC = () => {
  const router = useRouter();
  const [activity, setActivity] = useState<Activity>(featuredActivity);

  useEffect(() => {
    const { id } = router.params;
    if (!id) {
      setActivity(featuredActivity);
      return;
    }

    fetchActivityDetail(id)
      .then((detail) => setActivity(detail))
      .catch(() => setActivity(featuredActivity));
  }, [router.params]);

  const heroImages = useMemo(() => {
    const imageList = activity.covers && activity.covers.length > 0 ? activity.covers : [activity.cover || activity.coverImage];
    return imageList.filter(Boolean);
  }, [activity.cover, activity.coverImage, activity.covers]);

  const contentImages = useMemo(() => {
    const galleryImages = Array.from(new Set((activity.gallery || []).filter(Boolean)));
    return galleryImages.filter((item) => !heroImages.includes(item));
  }, [activity.gallery, heroImages]);

  const detailParagraphs = useMemo(() => {
    return activity.fullDescription
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }, [activity.fullDescription]);

  const tips = useMemo(() => {
    return [
      activity.includes.length > 0 ? `费用包含：${activity.includes.join('、')}` : '',
      activity.requirements.length > 0 ? `参与要求：${activity.requirements.join('、')}` : '',
      activity.refundPolicy ? `退款说明：${activity.refundPolicy}` : '',
    ].filter(Boolean);
  }, [activity.includes, activity.refundPolicy, activity.requirements]);

  const isEnded = activity.status === 'ended';
  const isFull = activity.currentParticipants >= activity.maxParticipants;
  const footerButtonText = isEnded ? '活动已结束' : isFull ? '名额已满' : '立即报名';

  const handlePreview = (current: string, urls: string[] = heroImages) => {
    if (!current) {
      return;
    }

    Taro.previewImage({ current, urls });
  };

  const handleSignup = () => {
    if (isEnded || isFull) {
      return;
    }

    Taro.navigateTo({ url: `/pages/register/index?activityId=${activity.id}` });
  };

  return (
    <View className={styles.container}>
      <ScrollView className={styles.scrollView} scrollY enableFlex>
        <View className={styles.heroSection}>
          {heroImages.length > 1 ? (
            <Swiper className={styles.heroSwiper} indicatorDots circular autoplay interval={3500}>
              {heroImages.map((image) => (
                <SwiperItem key={image}>
                  <View className={styles.heroImageWrap} onClick={() => handlePreview(image)}>
                    <Image className={styles.heroImage} src={image} mode="aspectFill" />
                  </View>
                </SwiperItem>
              ))}
            </Swiper>
          ) : (
            <View className={styles.heroImageWrap} onClick={() => handlePreview(heroImages[0])}>
              <Image className={styles.heroImage} src={heroImages[0]} mode="aspectFill" />
            </View>
          )}
        </View>

        <View className={styles.sheet}>
          <View className={styles.headerCard}>
            <View className={styles.tagRow}>
              {activity.tags.map((tag) => (
                <View key={tag} className={styles.tag}>
                  <Text className={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {activity.cardEligible ? (
                <View className={styles.cardTag}>
                  <Text className={styles.cardTagText}>支持次卡</Text>
                </View>
              ) : null}
            </View>

            <Text className={styles.title}>{activity.title}</Text>
            <Text className={styles.summary}>{activity.description}</Text>

            <View className={styles.metaGrid}>
              <View className={styles.metaCard}>
                <View className={styles.metaIcon}>
                  <Text className={styles.metaIconText}>时</Text>
                </View>
                <View className={styles.metaContent}>
                  <Text className={styles.metaLabel}>活动时间</Text>
                  <Text className={styles.metaValue}>{formatDate(activity.startDate)} {activity.startTime}-{activity.endTime}</Text>
                </View>
              </View>
            </View>

            <View className={styles.infoRow}>
              <View className={styles.priceTag}>
                <Text className={styles.priceTagText}>{formatPrice(activity.price)} / 人</Text>
              </View>
              <Text className={styles.infoText}>已报名 {activity.currentParticipants}/{activity.maxParticipants} 人</Text>
              <Text className={styles.infoText}>{getActivityStatusText(activity.status)}</Text>
            </View>
          </View>

          <View className={styles.contentCard}>
            <Text className={styles.sectionTitle}>活动正文</Text>
            {detailParagraphs.map((paragraph) => (
              <Text key={paragraph} className={styles.paragraph}>{paragraph}</Text>
            ))}

            {contentImages.length > 0 ? (
              <View className={styles.gallerySection}>
                {contentImages.map((image) => (
                  <View key={image} className={styles.galleryCard} onClick={() => handlePreview(image, contentImages)}>
                    <Image className={styles.galleryImage} src={image} mode="aspectFill" />
                  </View>
                ))}
              </View>
            ) : null}

            <View className={styles.hostSection}>
              <Text className={styles.sectionTitle}>活动主理人</Text>
              <View className={styles.hostCard}>
                <Image className={styles.hostAvatar} src={activity.hostAvatar} mode="aspectFill" />
                <View className={styles.hostContent}>
                  <Text className={styles.hostName}>{activity.hostName}</Text>
                  <Text className={styles.hostDescription}>{activity.hostDescription}</Text>
                </View>
              </View>
            </View>

            {tips.length > 0 ? (
              <View className={styles.tipSection}>
                <Text className={styles.sectionTitle}>报名须知</Text>
                {tips.map((item) => (
                  <Text key={item} className={styles.tipText}>{item}</Text>
                ))}
              </View>
            ) : null}
          </View>

          <View className={styles.bottomSpacing} />
        </View>
      </ScrollView>

      <View className={styles.actionBar}>
        <View className={styles.priceBlock}>
          <Text className={styles.footerPriceLabel}>活动价格</Text>
          <Text className={styles.footerPriceValue}>{formatPrice(activity.price)} / 人</Text>
        </View>
        <View className={styles.actionButtonWrap}>
          <Button type={isEnded || isFull ? 'secondary' : 'primary'} size="large" block disabled={isEnded || isFull} onClick={handleSignup}>
            {footerButtonText}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default ActivityDetailPage;
