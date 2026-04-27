import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, Swiper, SwiperItem, Text, Video, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import BottomSheet from '@/components/BottomSheet';
import CrossFadeGallery from '@/components/CrossFadeGallery';
import HomeStickyActions from '@/components/HomeStickyActions';
import WxLoginModal from '@/components/WxLoginModal';
import { fetchActivities, fetchPosterList, fetchSiteConfig } from '@/cloud/services';
import { ongoingActivities as activityFallback } from '@/data/activities';
import { defaultHomeVideos, homeLandingConfig, siteConfig as siteFallback, type HomeLandingConfig } from '@/data/site';
import { posters as posterFallback } from '@/data/posters';
import { useSiteConfig } from '@/shared/siteConfig';
import { fetchStories } from '@/services/stories';
import { useUserStore } from '@/store/userStore';
import type { Activity, Story } from '@/types';
import type { HomeVideo, SiteConfig } from '@/types/site';
import { formatDate } from '@/utils/helpers';
import { openVideoChannel } from '@/utils/video';
import styles from './index.module.scss';

const heroCover = require('@/assets/home/hero-cover.jpg');

type HomeSectionKey = 'dynamic' | 'space' | 'stories' | 'manifesto' | 'moreActivities' | 'owner' | 'community';

const HOME_SECTION_KEYS: HomeSectionKey[] = ['dynamic', 'space', 'stories', 'manifesto', 'moreActivities', 'owner', 'community'];
const COMMUNITY_SHEET_DURATION = 280;

const resolveHomeVideos = (site: SiteConfig): HomeVideo[] => {
  const withType = (videos: HomeVideo[]) => videos.map((item) => ({ ...item, type: item.type || 'video' }));

  if (Array.isArray(site.videos) && site.videos.length > 0) {
    return withType(site.videos);
  }

  if (site.finderUserName || site.videoCover) {
    return withType([
      {
        id: 'video-fallback',
        cover: site.videoCover || defaultHomeVideos[0].cover,
        title: '空间最新动态',
        finderUserName: site.finderUserName || defaultHomeVideos[0].finderUserName,
        feedId: '',
        type: 'video',
        videoLink: site.videoLink,
      }
    ]);
  }

  return withType(defaultHomeVideos);
};

const mergeSiteConfig = (site: SiteConfig): HomeLandingConfig => ({
  ...homeLandingConfig,
  ...site,
  videos: resolveHomeVideos(site)
});

export const handleStoryTap = (story: { id: string; title?: string; sourceUrl?: string }) => {
  if (story.sourceUrl) {
    Taro.navigateTo({
      url: `/pages/content/story-webview/index?url=${encodeURIComponent(story.sourceUrl)}&title=${encodeURIComponent(story.title ?? '')}`
    });
  } else {
    Taro.navigateTo({ url: `/pages/content/story-detail/index?id=${story.id}` });
  }
};

const HomePage: React.FC = () => {
  const { windowHeight } = Taro.getSystemInfoSync();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [posters, setPosters] = useState(posterFallback);
  const sharedSiteConfig = useSiteConfig();
  const [siteConfig, setSiteConfig] = useState<HomeLandingConfig>(mergeSiteConfig(siteFallback));
  const [ongoingActivities, setOngoingActivities] = useState<Activity[]>(activityFallback);
  const [stories, setStories] = useState<Story[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [sectionTops, setSectionTops] = useState<Partial<Record<HomeSectionKey, number>>>({});
  const [revealedSections, setRevealedSections] = useState<Record<HomeSectionKey, boolean>>({
    dynamic: false,
    space: false,
    stories: false,
    manifesto: false,
    moreActivities: true,
    owner: false,
    community: false,
  });
  const [communityVisible, setCommunityVisible] = useState(false);
  const [communityState, setCommunityState] = useState<'opening' | 'closing'>('opening');
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const hasCheckedLoginRef = useRef(false);

  useEffect(() => {
    if (sharedSiteConfig) {
      setSiteConfig((current) => ({
        ...current,
        communityQr: sharedSiteConfig.communityQrcode || current.communityQr,
        heroSlogan: sharedSiteConfig.heroSlogan || current.heroSlogan,
        heroTitle: sharedSiteConfig.heroTitle || current.heroTitle,
      }));
    }
  }, [sharedSiteConfig]);

  useEffect(() => {
    Promise.all([fetchPosterList(), fetchSiteConfig(), fetchActivities('ongoing'), fetchStories(5)])
      .then(([posterList, site, activities, storyList]) => {
        const mergedSite = mergeSiteConfig(site);
        setPosters(posterList.length > 0 ? posterList : posterFallback);
        setSiteConfig((current) => ({
          ...mergedSite,
          communityQr: current.communityQr,
          heroSlogan: current.heroSlogan,
          heroTitle: current.heroTitle,
        }));
        setOngoingActivities(activities.length > 0 ? activities : activityFallback);
        setStories(Array.isArray(storyList) ? storyList : []);
      })
      .catch(() => {
        setPosters(posterFallback);
        setSiteConfig(mergeSiteConfig(siteFallback));
        setOngoingActivities(activityFallback);
        setStories([]);
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      Taro.nextTick(() => {
        const query = Taro.createSelectorQuery();
        HOME_SECTION_KEYS.forEach((key) => query.select(`#home-section-${key}`).boundingClientRect());
        query.exec((rects) => {
          if (!Array.isArray(rects)) {
            return;
          }

          setSectionTops((current) => {
            const next = { ...current };
            HOME_SECTION_KEYS.forEach((key, index) => {
              const rect = rects[index] as { top?: number } | undefined;
              if (typeof rect?.top === 'number') {
                next[key] = rect.top;
              }
            });
            return next;
          });
        });
      });
    }, 160);

    return () => clearTimeout(timer);
  }, [ongoingActivities, posters, siteConfig, stories]);

  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (hasCheckedLoginRef.current) {
      return;
    }

    hasCheckedLoginRef.current = true;
    const timer = setTimeout(() => {
      if (!useUserStore.getState().isLoggedIn) {
        setLoginModalVisible(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasCheckedLoginRef.current) {
      return;
    }

    setLoginModalVisible(!isLoggedIn);
  }, [isLoggedIn]);

  const homeDynamics = useMemo(() => resolveHomeVideos(siteConfig), [siteConfig]);
  const moreActivitiesCount = ongoingActivities.length;
  const moreActivities = useMemo(() => ongoingActivities.slice(0, 4), [ongoingActivities]);
  const originExcerpt = siteConfig.originParagraphs[0] || '从下班后还能不能被认真接住开始，我们把这间房子做成了第二客厅。';
  const spaceSlides = useMemo(() => {
    const images = [...siteConfig.spaceGallery, ...posters.map((poster) => poster.coverImage)].filter(Boolean);
    return Array.from(new Set(images)).slice(0, 5).map((image, index) => ({
      image,
      title: posters[index]?.title || `灵感茶室 ${index + 1}`,
    }));
  }, [posters, siteConfig.spaceGallery]);

  const fallbackTops: Record<HomeSectionKey, number> = {
    dynamic: windowHeight * 0.9,
    space: windowHeight * 1.8,
    stories: windowHeight * 2.7,
    manifesto: windowHeight * 3.6,
    moreActivities: windowHeight * 4.5,
    owner: windowHeight * 5.3,
    community: windowHeight * 6.1,
  };

  const revealSections = (nextScrollTop: number) => {
    setRevealedSections((current) => {
      let changed = false;
      const next = { ...current };

      HOME_SECTION_KEYS.forEach((key) => {
        if (next[key]) {
          return;
        }

        const top = sectionTops[key] ?? fallbackTops[key];
        if (nextScrollTop + windowHeight * 0.84 >= top) {
          next[key] = true;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  };

  const handleVideoClick = async (video: HomeVideo) => {
    await openVideoChannel({
      finderUserName: video.finderUserName,
      feedId: video.feedId,
      videoLink: video.videoLink,
    });
  };

  const handleDynamicClick = async (dynamic: HomeVideo) => {
    if (dynamic.type === 'story' && dynamic.relatedId) {
      const matchStory = stories.find(s => s.id === dynamic.relatedId);
      if (matchStory) {
        handleStoryTap(matchStory);
      } else {
        await Taro.navigateTo({ url: `/pages/content/story-detail/index?id=${dynamic.relatedId}` });
      }
      return;
    }

    if (dynamic.type === 'activity' && dynamic.relatedId) {
      await Taro.navigateTo({ url: `/pages/content/activity-detail/index?id=${dynamic.relatedId}` });
      return;
    }

    if (dynamic.type === 'external' && dynamic.cover) {
      await Taro.previewImage({ current: dynamic.cover, urls: [dynamic.cover] });
      return;
    }

    if (dynamic.finderUserName || dynamic.videoLink) {
      await handleVideoClick(dynamic);
      return;
    }

    Taro.showToast({ title: '敬请期待', icon: 'none' });
  };

  const handleJoinCommunity = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    setCommunityState('opening');
    setCommunityVisible(true);
  };

  const handleCloseCommunity = () => {
    if (!communityVisible) {
      return;
    }

    setCommunityState('closing');
    closeTimerRef.current = setTimeout(() => {
      setCommunityVisible(false);
    }, COMMUNITY_SHEET_DURATION);
  };

  return (
    <View className={styles.page}>
      <ScrollView
        className={styles.scrollView}
        scrollY
        enableFlex
        showScrollbar={false}
        onScroll={(event) => {
          const nextScrollTop = event.detail.scrollTop;
          setScrollTop(nextScrollTop);
          revealSections(nextScrollTop);
        }}
      >
        <View className={styles.pageShell}>
          <View className={classnames(styles.heroSection, styles.revealed)}>
            <Text className={classnames(styles.heroTitle, 'font-display')}>{siteConfig.heroTitle || '4月故事录'}</Text>
            <Image className={styles.heroCover} src={heroCover} mode="widthFix" />
          </View>

          <View
            id="home-section-moreActivities"
            className={classnames(styles.section, styles.revealSection, revealedSections.moreActivities && styles.revealed)}
          >
            <View className={styles.moreHeaderRow}>
              <View className={styles.moreTitlePill}>
                <Text className={classnames(styles.moreTitleText, 'font-display')}>更多活动</Text>
              </View>
              <View className={styles.moreHeaderRight}>
                <View className={styles.moreCountBadge}>
                  <Text className={styles.moreCountText}>{`${moreActivitiesCount} ENTRIES`}</Text>
                </View>
                <Text className={styles.moreLink} onClick={() => Taro.switchTab({ url: '/pages/activity/index' })}>
                  查看全部
                </Text>
              </View>
            </View>

            {moreActivities.length > 0 ? (
              <View className={styles.moreGrid}>
                {moreActivities.map((activity) => (
                  <View
                    key={activity.id}
                    className={styles.activityCard}
                    onClick={() => Taro.navigateTo({ url: `/pages/content/activity-detail/index?id=${activity.id}` })}
                  >
                    <Image
                      className={classnames('image-4by3', styles.activityCover)}
                      src={activity.cover || activity.coverImage}
                      mode="aspectFill"
                    />
                    <View className={styles.activityBody}>
                      <Text className={classnames(styles.activityTitle, 'font-display')}>{activity.title}</Text>
                      <Text className={styles.activityMeta}>{formatDate(activity.startDate)}</Text>
                      <View className={styles.activityAction}>
                        <Text className={styles.activityActionText}>立即报名</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className={styles.emptyPanel}>
                <Text className={styles.emptyText}>暂无招募中活动，看看过往回顾吧</Text>
                <Text className={styles.emptyLink} onClick={() => Taro.switchTab({ url: '/pages/activity/index' })}>
                  去活动页看看
                </Text>
              </View>
            )}
          </View>

          {stories.length > 0 && (
          <View id="home-section-dynamic" className={classnames(styles.section, styles.revealSection, revealedSections.dynamic && styles.revealed)}>
            <View className={styles.sectionHeadingRow}>
              <View>
                <Text className={classnames(styles.sectionTitle, 'font-display')}>动态</Text>
                <Text className={styles.sectionSubtitle}>最近发生的故事</Text>
              </View>
              {stories.length > 1 && <Text className={styles.sectionAside}>每 4 秒翻一页</Text>}
            </View>
            <Swiper
              className={styles.dynamicSwiper}
              indicatorDots={stories.length > 1}
              indicatorColor="rgba(0,0,0,.18)"
              indicatorActiveColor="#E60000"
              autoplay={stories.length > 1}
              interval={4000}
              circular={stories.length > 1}
            >
              {stories.map((story) => (
                <SwiperItem key={story.id}>
                  <View className={styles.dynamicItem} onClick={() => handleStoryTap(story)}>
                    <Image className={classnames('image-4by3', styles.dynamicMedia)} src={story.cover} mode="aspectFill" />
                    <View className={styles.dynamicOverlay}>
                      <Text className={classnames(styles.dynamicTitle, 'font-display')}>{story.title}</Text>
                      <Text className={styles.dynamicMeta}>点击查看故事详情</Text>
                    </View>
                  </View>
                </SwiperItem>
              ))}
            </Swiper>
          </View>
          )}

          {homeDynamics.length > 0 && (
            <View className={classnames(styles.section, styles.revealSection, revealedSections.dynamic && styles.revealed)}>
              <View className={styles.sectionHeadingRow}>
                <View>
                  <Text className={classnames(styles.sectionTitle, 'font-display')}>视频动态</Text>
                  <Text className={styles.sectionSubtitle}>空间最新视频</Text>
                </View>
              </View>
              <View className={styles.storyList}>
                {homeDynamics.map((dynamic) => (
                  <View key={dynamic.id} className={styles.dynamicItem} style={{ marginBottom: 16 }} onClick={() => handleDynamicClick(dynamic)}>
                    {dynamic.videoUrl ? (
                      <Video className={classnames('image-4by3', styles.dynamicMedia)} src={dynamic.videoUrl} autoplay loop muted controls={false} objectFit="cover" />
                    ) : (
                      <Image className={classnames('image-4by3', styles.dynamicMedia)} src={dynamic.cover} mode="aspectFill" />
                    )}
                    <View className={styles.dynamicOverlay}>
                      <Text className={classnames(styles.dynamicTitle, 'font-display')}>{dynamic.title}</Text>
                      <Text className={styles.dynamicMeta}>点击查看视频</Text>
                    </View>
                    {!dynamic.finderUserName && (
                      <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4, zIndex: 10 }}>
                        <Text style={{ color: '#fff', fontSize: 12 }}>点击查看视频号</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}


          <View id="home-section-space" className={classnames(styles.section, styles.revealSection, styles.spaceSection, revealedSections.space && styles.revealed)}>
            <Text className={classnames(styles.sectionTitle, 'font-display')}>空间</Text>
            <View className={styles.spaceGalleryWrap}>
              <CrossFadeGallery slides={spaceSlides} />
              <Text className={styles.spaceVerticalText}>慢一点 · 坐一会 · 再聊</Text>
            </View>
            <Text className={styles.sectionCopy}>{siteConfig.spaceDescription}</Text>
            <Text className={styles.spaceIntro}>{originExcerpt}</Text>
            <View className={styles.spaceFooter}>
              <View />
              <View className={styles.exploreMore} onClick={() => Taro.navigateTo({ url: '/pages/content/origin-detail/index' })}>
                <Text className={styles.exploreMoreText}>探索更多</Text>
                <Text className={styles.exploreMoreArrow}>→</Text>
              </View>
            </View>
          </View>


          <View id="home-section-stories" className={classnames(styles.section, styles.revealSection, revealedSections.stories && styles.revealed)}>
            <View className={styles.sectionHeadingRow}>
              <View>
                <Text className={classnames(styles.sectionTitle, 'font-display')}>社畜故事</Text>
                <Text className={styles.sectionSubtitle}>那些被看见的瞬间</Text>
              </View>
            </View>
            {stories.length > 0 ? (
              <View className={styles.storyList}>
                {stories.map((story) => (
                  <View key={story.id} className={styles.storyCard} onClick={() => handleStoryTap(story)}>
                    <Image className={classnames('image-4by3', styles.storyCover)} src={story.cover} mode="aspectFill" />
                    <View className={styles.storyBody}>
                      <Text className={classnames(styles.storyTitle, 'font-display')}>{story.title}</Text>
                      <Text className={styles.storyExcerpt}>{story.excerpt}</Text>
                      <Text className={styles.storyMeta}>{formatDate(story.publishAt)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className={styles.emptyPanel}>
                <Text className={styles.emptyText}>故事正在酝酿中...</Text>
              </View>
            )}
          </View>


          <View id="home-section-owner" className={classnames(styles.section, styles.revealSection, styles.ownerSection, revealedSections.owner && styles.revealed)}>
            <Text className={classnames(styles.sectionTitle, 'font-display')}>主理人</Text>
            <View className={styles.ownerLayout}>
              <View className={styles.ownerImageFrame}>
                <Image className={styles.ownerImage} src={siteConfig.ownerAvatar} mode="aspectFill" />
              </View>
              <View className={styles.ownerContent}>
                <Text className={styles.ownerName}>{siteConfig.ownerName}</Text>
                <Text className={styles.ownerIntro}>把旧物、茶杯和夜谈都留给真正需要放松的人。</Text>
                <Text className={styles.ownerBio}>{siteConfig.ownerBio}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <HomeStickyActions
        hidden={scrollTop > windowHeight * 2.2}
        onBook={() => Taro.switchTab({ url: '/pages/activity/index' })}
        onJoin={handleJoinCommunity}
      />

      <BottomSheet visible={communityVisible} state={communityState} onClose={handleCloseCommunity} height="58vh">
        <View className={styles.communitySheet}>
          <Text className={classnames(styles.communityTitle, 'font-display')}>加入社群</Text>
          <Text className={styles.communityText}>微信扫码加入群聊，活动开场、临时加场和夜谈通知都会在这里同步。</Text>
          <Image className={styles.communityQr} src={siteConfig.communityQr || ''} mode="aspectFit" />
          <Text className={styles.communityNote}>当前为占位二维码，后续可由运营替换为真实群码。</Text>
        </View>
      </BottomSheet>

      <WxLoginModal visible={loginModalVisible} />
    </View>
  );
};

export default HomePage;
