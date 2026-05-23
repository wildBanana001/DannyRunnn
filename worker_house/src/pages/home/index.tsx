import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import BottomSheet from '@/components/BottomSheet';
import WxLoginModal from '@/components/WxLoginModal';
import { fetchActivities, fetchPosterList } from '@/cloud/services';
import { ongoingActivities as activityFallback } from '@/data/activities';
import { homeLandingConfig } from '@/data/site';
import { wechatArticleImageUrls } from '@/data/wechat-images';
import { useSiteConfig } from '@/shared/siteConfig';
import { fetchStories } from '@/services/stories';
import { useUserStore } from '@/store/userStore';
import type { Activity, Story } from '@/types';
import type { Poster } from '@/types/site';
import { openChannelsHome } from '@/utils/video';
import styles from './index.module.scss';

const COMMUNITY_SHEET_DURATION = 280;
const HOME_TEXT_IMAGE_PROPS: Record<string, any> = { mode: 'widthFix', lazyLoad: true, 'show-menu-by-longpress': false };

// 切图（艺术字 / 按钮 / 徽章）打包进小程序，杜绝远程依赖
const TEXT_ASSETS = {
  heroTitle: require('@/assets/home/text/title-shechu-hero.png'),
  bookActivity: require('@/assets/home/text/btn-book-activity.png'),
  joinCommunity: require('@/assets/home/text/btn-join-community.png'),
  moreActivities: require('@/assets/home/text/title-more-activities.png'),
  aprilStories: require('@/assets/home/text/title-april-stories.png'),
  dreamEnglish: require('@/assets/home/text/title-dream-english.png'),
  newLifeStyle: require('@/assets/home/text/title-new-life-style.png'),
  exploreMore: require('@/assets/home/text/btn-explore-more.png'),
  happyHouse: require('@/assets/home/text/title-happy-house.png'),
  spaceStory: require('@/assets/home/text/btn-space-story.png'),
  shechuStories: require('@/assets/home/text/title-shechu-stories.png'),
  moreFun: require('@/assets/home/text/btn-more-fun.png'),
  owner: require('@/assets/home/text/title-owner.png'),
  orangeLabel: require('@/assets/home/text/label-orange.png'),
  xiaoheiLabel: require('@/assets/home/text/label-xiaohei.png'),
  letsParty: require('@/assets/home/text/badge-lets-party.png'),
};

// 默认内容大图直接走 CDN（项目已有），避免相对路径回落造成空白
const HOME_ASSETS = {
  hero: wechatArticleImageUrls.img05,
  april: wechatArticleImageUrls.img04,
  space: wechatArticleImageUrls.img29,
  stories: [
    { id: 'story-sanjiaozhu', title: '社畜x三脚猪', image: wechatArticleImageUrls.img17 },
    { id: 'story-mcdonald', title: '社畜x麦当劳', image: wechatArticleImageUrls.img18 },
    { id: 'story-need', title: '社畜xneed', image: wechatArticleImageUrls.img07 },
  ],
  text: TEXT_ASSETS,
};

const FALLBACK_OWNER_CARDS = [
  {
    id: 'owner-orange',
    avatar: wechatArticleImageUrls.img12,
    label: '橙子',
    description: '互联网大厂裸辞，正在探索新新人类生活方式，徒手爆改80m²社畜快乐屋，旅游狂热分子，enfj理想主义体验派！',
  },
  {
    id: 'owner-cat',
    avatar: wechatArticleImageUrls.img15,
    label: '小黑',
    description: '一只3岁的粘人奶牛猫，社畜团宠，一脸正义又娇憨可爱的黑猫警长，yes sir~',
  },
];

interface StoryCardItem {
  id: string;
  title: string;
  image: string;
  story?: Story;
}

export const handleStoryTap = (story: { id: string; title?: string; sourceUrl?: string; cover?: string; author?: string; publishAt?: string; excerpt?: string }) => {
  if (story.sourceUrl) {
    const params = [
      `url=${encodeURIComponent(story.sourceUrl)}`,
      `title=${encodeURIComponent(story.title ?? '')}`,
      `cover=${encodeURIComponent(story.cover ?? '')}`,
      `author=${encodeURIComponent(story.author ?? '')}`,
      `date=${encodeURIComponent(story.publishAt ?? '')}`,
      `excerpt=${encodeURIComponent(story.excerpt ?? '')}`,
    ].join('&');
    Taro.navigateTo({ url: `/pages/content/story-webview/index?${params}` });
    return;
  }

  Taro.navigateTo({ url: `/pages/content/story-detail/index?id=${story.id}` });
};

const HomePage: React.FC = () => {
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ongoingActivitiesState, setOngoingActivitiesState] = useState<Activity[]>(activityFallback);
  const [posters, setPosters] = useState<Poster[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [communityVisible, setCommunityVisible] = useState(false);
  const [communityState, setCommunityState] = useState<'opening' | 'closing'>('opening');
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const hasCheckedLoginRef = useRef(false);
  const sharedSiteConfig = useSiteConfig();

  const loadActivities = () => {
    fetchActivities('ongoing').then((activities) => {
      setOngoingActivitiesState(activities.length > 0 ? activities : activityFallback);
    }).catch(() => {
      setOngoingActivitiesState(activityFallback);
    });
  };

  const loadPosters = () => {
    fetchPosterList().then((list) => {
      setPosters(Array.isArray(list) ? list.filter((item) => item && item.coverImage) : []);
    }).catch(() => {
      setPosters([]);
    });
  };

  const loadStories = () => {
    fetchStories(3).then((list) => {
      setStories(Array.isArray(list) ? list : []);
    }).catch(() => {
      setStories([]);
    });
  };

  useEffect(() => {
    loadActivities();
    loadPosters();
    loadStories();
  }, []);

  useDidShow(() => {
    loadActivities();
    loadPosters();
    loadStories();
  });

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  useEffect(() => {
    if (hasCheckedLoginRef.current) return;
    hasCheckedLoginRef.current = true;
    const timer = setTimeout(() => {
      if (!useUserStore.getState().isLoggedIn) setLoginModalVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasCheckedLoginRef.current) return;
    setLoginModalVisible(!isLoggedIn);
  }, [isLoggedIn]);

  const communityQr = sharedSiteConfig?.communityQrcode || homeLandingConfig.communityQr || '';
  const homeCopyLead = sharedSiteConfig?.homeCopyLead || 'Hiiii这里是社畜没有派对！';
  const homeCopyBody = sharedSiteConfig?.homeCopyBody || '一个通过客厅建立有趣新人类社交方式的城市共居空间，这里为社交、文化、艺术、共创、女性友好住宿等一切创意活动无限开放';
  const finderUserName = sharedSiteConfig?.homeChannelsFinder || 'sph_worker_house_demo';
  const moreActivities = useMemo(() => ongoingActivitiesState.slice(0, 2), [ongoingActivitiesState]);

  const heroSlides = useMemo(() => {
    if (posters.length > 0) {
      return posters.map((poster) => ({
        id: poster.id,
        image: poster.coverImage,
      }));
    }
    return [];
  }, [posters]);

  const spaceImages = useMemo(() => {
    const list = (sharedSiteConfig?.homeSpaceImages ?? []).filter((item) => typeof item === 'string' && item.length > 0);
    return list.length > 0 ? list : [HOME_ASSETS.space];
  }, [sharedSiteConfig?.homeSpaceImages]);

  const ownerCards = useMemo(() => {
    const list = sharedSiteConfig?.homeOwners ?? [];
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return FALLBACK_OWNER_CARDS;
  }, [sharedSiteConfig?.homeOwners]);

  const storyCards: StoryCardItem[] = useMemo(() => {
    if (stories.length > 0) {
      return stories.slice(0, 3).map((story) => ({
        id: story.id,
        title: story.title,
        image: story.cover,
        story,
      }));
    }
    return HOME_ASSETS.stories.map((item) => ({
      id: item.id,
      title: item.title,
      image: item.image,
    }));
  }, [stories]);

  const handleJoinCommunity = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setCommunityState('opening');
    setCommunityVisible(true);
  };

  const handleCloseCommunity = () => {
    if (!communityVisible) return;
    setCommunityState('closing');
    closeTimerRef.current = setTimeout(() => setCommunityVisible(false), COMMUNITY_SHEET_DURATION);
  };

  const handleHeroTap = (posterId: string) => {
    if (!posterId) return;
    void Taro.navigateTo({ url: `/pages/poster-detail/index?id=${encodeURIComponent(posterId)}` });
  };

  const handleStoryCardTap = (item: StoryCardItem) => {
    if (item.story) {
      handleStoryTap(item.story);
    }
  };

  const handleMoreFun = () => {
    void Taro.navigateTo({ url: '/pages/content/story-webview/index?mode=official-home' });
  };

  return (
    <View className={styles.page}>
      <ScrollView className={styles.scrollView} scrollY enableFlex showScrollbar={false}>
        <View className={styles.pageShell}>
          <View className={styles.heroSection}>
            <View className={styles.heroTopRow}>
              <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.heroTitleImage} src={HOME_ASSETS.text.heroTitle} />
              <Text className={styles.heroSpark}>📷</Text>
            </View>
            <View className={styles.heroCard}>
              {heroSlides.length > 0 ? (
                <Swiper
                  className={styles.heroSwiper}
                  autoplay
                  circular
                  indicatorDots
                  indicatorActiveColor="#fff"
                  indicatorColor="rgba(255,255,255,0.5)"
                  interval={3500}
                >
                  {heroSlides.map((slide) => (
                    <SwiperItem key={slide.id}>
                      <View className={styles.heroSwiperItem} onClick={() => handleHeroTap(slide.id)}>
                        <Image className={styles.heroImage} src={slide.image} mode="aspectFit" lazyLoad />
                      </View>
                    </SwiperItem>
                  ))}
                </Swiper>
              ) : (
                <Image className={styles.heroImage} src={HOME_ASSETS.hero} mode="widthFix" lazyLoad />
              )}
            </View>
            <View className={styles.actionRow}>
              <View className={styles.actionImageButton} onClick={() => Taro.switchTab({ url: '/pages/activity/index' })}>
                <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.actionImage} src={HOME_ASSETS.text.bookActivity} />
              </View>
              <View className={styles.actionImageButton} onClick={handleJoinCommunity}>
                <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.actionImage} src={HOME_ASSETS.text.joinCommunity} />
              </View>
            </View>
          </View>

          <View className={`${styles.section} ${styles.moreSection}`}>
            <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.moreTitleImage} src={HOME_ASSETS.text.moreActivities} />
            <View className={styles.moreInner}>
              {moreActivities.length > 0 ? (
                <View className={styles.activityList}>
                  {moreActivities.map((activity) => (
                    <View
                      key={activity.id}
                      className={styles.activityCard}
                      onClick={() => void Taro.navigateTo({ url: `/pages/content/activity-detail/index?id=${activity.id}` })}
                    >
                      <Image className={styles.activityThumb} src={activity.cover || activity.coverImage} mode="aspectFill" lazyLoad />
                      <View className={styles.activityContent}>
                        <Text className={styles.activityStatus}>招募中</Text>
                        <Text className={styles.activityTitle}>{activity.title}</Text>
                      </View>
                      <Text className={styles.activityArrow}>↗</Text>
                    </View>
                  ))}
                </View>
              ) : <View className={styles.emptyPanel}><Text className={styles.emptyText}>暂无招募中活动，先去活动页逛逛吧。</Text></View>}
            </View>
          </View>

          <View className={`${styles.section} ${styles.aprilSection}`}>
            <View className={styles.aprilCollageStage}>
              <Image className={styles.aprilCollage} src={HOME_ASSETS.april} mode="widthFix" lazyLoad />
            </View>
            <View className={styles.copyBlock}>
              <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.newLifeStyleImage} src={HOME_ASSETS.text.newLifeStyle} />
              <Text className={styles.copyLead}>{homeCopyLead}</Text>
              <Text className={styles.sectionCopy}>{homeCopyBody}</Text>
            </View>
            <View className={styles.sectionFooter}>
              <View className={styles.sectionImageButton} onClick={() => Taro.switchTab({ url: '/pages/activity/index' })}>
                <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.sectionButtonImage} src={HOME_ASSETS.text.exploreMore} />
              </View>
            </View>
          </View>

          <View className={`${styles.section} ${styles.spaceSection}`}>
            <View className={styles.spaceVisual}>
              {spaceImages.length > 1 ? (
                <Swiper
                  className={styles.spaceSwiper}
                  autoplay
                  circular
                  indicatorDots
                  indicatorActiveColor="#fff"
                  indicatorColor="rgba(255,255,255,0.5)"
                  interval={4000}
                >
                  {spaceImages.map((image) => (
                    <SwiperItem key={image}>
                      <Image className={styles.spaceImage} src={image} mode="aspectFill" lazyLoad />
                    </SwiperItem>
                  ))}
                </Swiper>
              ) : (
                <Image className={styles.spaceImage} src={spaceImages[0]} mode="widthFix" lazyLoad />
              )}
            </View>
            <View className={styles.spaceIntroRow}>
              <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.spaceTitleImage} src={HOME_ASSETS.text.happyHouse} />
              <View className={styles.spaceCopyBlock}>
                <Text className={styles.copyLead}>{homeCopyLead}</Text>
                <Text className={styles.sectionCopy}>{homeCopyBody}</Text>
              </View>
            </View>
            <View className={`${styles.sectionFooter} ${styles.spaceFooter}`}>
              <View className={styles.sectionImageButton} onClick={() => void openChannelsHome(finderUserName)}>
                <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.sectionButtonImage} src={HOME_ASSETS.text.spaceStory} />
              </View>
            </View>
          </View>

          <View className={`${styles.section} ${styles.storySection}`}>
            <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.sectionTitleImage} src={HOME_ASSETS.text.shechuStories} />
            <View className={styles.storyList}>
              {storyCards.map((item) => (
                <View key={item.id} className={styles.storyCard} onClick={() => handleStoryCardTap(item)}>
                  <Image className={styles.storyImage} src={item.image} mode="aspectFill" lazyLoad />
                  <View className={styles.storyOverlay}><Text className={styles.storyOverlayText}>{item.title}</Text></View>
                </View>
              ))}
            </View>
            <View className={`${styles.sectionFooter} ${styles.storyFooter}`}>
              <View className={styles.sectionImageButton} onClick={handleMoreFun}>
                <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.moreFunImage} src={HOME_ASSETS.text.moreFun} />
              </View>
            </View>
          </View>

          <View className={`${styles.section} ${styles.ownersSection}`}>
            <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.ownerTitleImage} src={HOME_ASSETS.text.owner} />
            <View className={styles.ownerList}>
              {ownerCards.map((owner, index) => (
                <View key={owner.id} className={`${styles.ownerCard} ${index % 2 === 1 ? styles.ownerCardReverse : ''}`}>
                  <View className={`${styles.ownerAvatar} ${index % 2 === 1 ? styles.ownerAvatarXiaohei : styles.ownerAvatarOrange}`}>
                    {owner.avatar ? (
                      <Image className={styles.ownerAvatarImage} src={owner.avatar} mode="aspectFill" lazyLoad />
                    ) : (
                      <Text className={styles.ownerEmoji}>{index % 2 === 1 ? '🐈‍⬛' : '🍊'}</Text>
                    )}
                  </View>
                  <View className={styles.ownerBody}>
                    {owner.label ? (
                      <Text className={`${styles.ownerLabelText} ${index % 2 === 1 ? styles.ownerLabelXiaoheiText : styles.ownerLabelOrangeText}`}>{owner.label}</Text>
                    ) : null}
                    <Text className={styles.ownerDescription}>{owner.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className={styles.badgeSection}>
            <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.badgeImage} src={HOME_ASSETS.text.letsParty} />
          </View>
        </View>
      </ScrollView>

      <BottomSheet visible={communityVisible} state={communityState} onClose={handleCloseCommunity} height="58vh">
        <View className={styles.communitySheet}>
          <Text className={styles.communityTitle}>加入社群</Text>
          <Text className={styles.communityText}>微信扫码加入群聊，活动开场、临时加场和夜谈通知都会在这里同步。</Text>
          <Image className={styles.communityQr} src={communityQr} mode="aspectFit" />
          <Text className={styles.communityNote}>真机扫码即可加入；若群码失效，可联系主理人更新。</Text>
        </View>
      </BottomSheet>

      <WxLoginModal visible={loginModalVisible} />
    </View>
  );
};

export default HomePage;
