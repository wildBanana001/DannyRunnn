import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import BottomSheet from '@/components/BottomSheet';
import WxLoginModal from '@/components/WxLoginModal';
import { fetchActivities } from '@/cloud/services';
import { ongoingActivities as activityFallback } from '@/data/activities';
import { DEFAULT_FINDER_USER_NAME, getSiteAssetUrl, homeLandingConfig } from '@/data/site';
import { useSiteConfig } from '@/shared/siteConfig';
import { useUserStore } from '@/store/userStore';
import type { Activity } from '@/types';
import { openChannelsHome } from '@/utils/video';
import { openOfficialAccountPage } from '@/utils/wechat';
import styles from './index.module.scss';

const COMMUNITY_SHEET_DURATION = 280;
const HOME_COPY_LEAD = 'Hiiii这里是社畜没有派对！';
const HOME_COPY_BODY = '一个通过客厅建立有趣新人类社交方式的城市共居空间，这里为社交、文化、艺术、共创、女性友好住宿等一切创意活动无限开放';
const HERO_DOTS = [0, 1, 2];
const HOME_TEXT_IMAGE_PROPS: Record<string, any> = { mode: 'widthFix', lazyLoad: true, 'show-menu-by-longpress': false };

const resolveAssetUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  try {
    return typeof getSiteAssetUrl === 'function' ? getSiteAssetUrl(normalizedPath) : normalizedPath;
  } catch {
    return normalizedPath;
  }
};

const getHomeTextAssetUrl = (name: string) => resolveAssetUrl(`/images/home/text/${name}`);

const HOME_ASSETS = {
  hero: resolveAssetUrl('/static/images/home/hero-may.jpg'),
  april: resolveAssetUrl('/static/images/home/more-collage-april.png'),
  space: resolveAssetUrl('/static/images/home/space-livingroom.jpg'),
  stories: [
    { id: 'story-sanjiaozhu', title: '社畜x三脚猪', image: resolveAssetUrl('/static/images/home/story-sanjiaozhu.jpg') },
    { id: 'story-mcdonald', title: '社畜x麦当劳', image: resolveAssetUrl('/static/images/home/story-mcdonald.jpg') },
    { id: 'story-need', title: '社畜xneed', image: resolveAssetUrl('/static/images/home/story-need.jpg') },
  ],
  text: {
    heroTitle: getHomeTextAssetUrl('title-shechu-hero.png'),
    bookActivity: getHomeTextAssetUrl('btn-book-activity.png'),
    joinCommunity: getHomeTextAssetUrl('btn-join-community.png'),
    moreActivities: getHomeTextAssetUrl('title-more-activities.png'),
    aprilStories: getHomeTextAssetUrl('title-april-stories.png'),
    dreamEnglish: getHomeTextAssetUrl('title-dream-english.png'),
    newLifeStyle: getHomeTextAssetUrl('title-new-life-style.png'),
    exploreMore: getHomeTextAssetUrl('btn-explore-more.png'),
    happyHouse: getHomeTextAssetUrl('title-happy-house.png'),
    spaceStory: getHomeTextAssetUrl('btn-space-story.png'),
    shechuStories: getHomeTextAssetUrl('title-shechu-stories.png'),
    moreFun: getHomeTextAssetUrl('btn-more-fun.png'),
    owner: getHomeTextAssetUrl('title-owner.png'),
    orangeLabel: getHomeTextAssetUrl('label-orange.png'),
    xiaoheiLabel: getHomeTextAssetUrl('label-xiaohei.png'),
    letsParty: getHomeTextAssetUrl('badge-lets-party.png'),
  },
};

const OWNER_CARDS = [
  {
    id: 'owner-orange',
    emoji: '🍊',
    label: HOME_ASSETS.text.orangeLabel,
    description: '互联网大厂裸辞，正在探索新新人类生活方式，徒手爆改80m²社畜快乐屋，旅游狂热分子，enfj理想主义体验派！',
  },
  {
    id: 'owner-cat',
    emoji: '🐈‍⬛',
    label: HOME_ASSETS.text.xiaoheiLabel,
    description: '一只3岁的粘人奶牛猫，社畜团宠，一脸正义又娇憨可爱的黑猫警长，yes sir~',
  },
] as const;

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
  const [ongoingActivities, setOngoingActivities] = useState<Activity[]>(activityFallback);
  const [communityVisible, setCommunityVisible] = useState(false);
  const [communityState, setCommunityState] = useState<'opening' | 'closing'>('opening');
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const hasCheckedLoginRef = useRef(false);
  const sharedSiteConfig = useSiteConfig();

  useEffect(() => {
    fetchActivities('ongoing').then((activities) => {
      setOngoingActivities(activities.length > 0 ? activities : activityFallback);
    }).catch(() => {
      setOngoingActivities(activityFallback);
    });
  }, []);

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
  const moreActivities = useMemo(() => ongoingActivities.slice(0, 2), [ongoingActivities]);

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

  return (
    <View className={styles.page}>
      <ScrollView className={styles.scrollView} scrollY enableFlex showScrollbar={false}>
        <View className={styles.pageShell}>
          <View className={styles.heroSection}>
            <View className={styles.heroTopRow}>
              <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.heroTitleImage} src={HOME_ASSETS.text.heroTitle} />
              <View className={styles.heroSpark} />
            </View>
            <View className={styles.heroCard}>
              <Image className={styles.heroImage} src={HOME_ASSETS.hero} mode="widthFix" lazyLoad />
            </View>
            <View className={styles.dotRow}>{HERO_DOTS.map((dot) => <View key={dot} className={`${styles.dot} ${dot === 0 ? styles.dotActive : ''}`} />)}</View>
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

          <View className={`${styles.section} ${styles.aprilSection}`}>
            <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.newLifeStyleImage} src={HOME_ASSETS.text.newLifeStyle} />
            <View className={styles.aprilCollageStage}>
              <Image className={styles.aprilCollage} src={HOME_ASSETS.april} mode="widthFix" lazyLoad />
              <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.aprilStoriesImage} src={HOME_ASSETS.text.aprilStories} />
              <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.dreamEnglishImage} src={HOME_ASSETS.text.dreamEnglish} />
            </View>
            <View className={styles.copyBlock}>
              <Text className={styles.copyLead}>{HOME_COPY_LEAD}</Text>
              <Text className={styles.sectionCopy}>{HOME_COPY_BODY}</Text>
            </View>
            <View className={styles.sectionFooter}>
              <View className={styles.sectionImageButton} onClick={() => Taro.switchTab({ url: '/pages/activity/index' })}>
                <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.sectionButtonImage} src={HOME_ASSETS.text.exploreMore} />
              </View>
            </View>
          </View>

          <View className={`${styles.section} ${styles.spaceSection}`}>
            <View className={styles.spaceVisual}>
              <Image className={styles.spaceImage} src={HOME_ASSETS.space} mode="widthFix" lazyLoad />
              <View className={`${styles.dotRow} ${styles.spaceDotRow}`}>{HERO_DOTS.map((dot) => <View key={`space-${dot}`} className={`${styles.dot} ${styles.spaceDot} ${dot === 0 ? styles.dotActive : ''}`} />)}</View>
            </View>
            <View className={styles.spaceIntroRow}>
              <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.spaceTitleImage} src={HOME_ASSETS.text.happyHouse} />
              <View className={styles.spaceCopyBlock}>
                <Text className={`${styles.copyLead} ${styles.spaceCopyLead}`}>{HOME_COPY_LEAD}</Text>
                <Text className={`${styles.sectionCopy} ${styles.rightAlignedCopy}`}>{HOME_COPY_BODY}</Text>
              </View>
            </View>
            <View className={`${styles.sectionFooter} ${styles.spaceFooter}`}>
              <View className={styles.sectionImageButton} onClick={() => void openChannelsHome(DEFAULT_FINDER_USER_NAME)}>
                <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.sectionButtonImage} src={HOME_ASSETS.text.spaceStory} />
              </View>
            </View>
          </View>

          <View className={`${styles.section} ${styles.storySection}`}>
            <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.sectionTitleImage} src={HOME_ASSETS.text.shechuStories} />
            <View className={styles.storyList}>
              {HOME_ASSETS.stories.map((story) => (
                <View key={story.id} className={styles.storyCard}>
                  <Image className={styles.storyImage} src={story.image} mode="aspectFill" lazyLoad />
                  <View className={styles.storyOverlay}><Text className={styles.storyOverlayText}>{story.title}</Text></View>
                </View>
              ))}
            </View>
            <View className={`${styles.sectionFooter} ${styles.storyFooter}`}>
              <View className={styles.sectionImageButton} onClick={() => void openOfficialAccountPage()}>
                <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.moreFunImage} src={HOME_ASSETS.text.moreFun} />
              </View>
            </View>
          </View>

          <View className={`${styles.section} ${styles.ownersSection}`}>
            <Image {...HOME_TEXT_IMAGE_PROPS} className={styles.ownerTitleImage} src={HOME_ASSETS.text.owner} />
            <View className={styles.ownerList}>
              {OWNER_CARDS.map((owner, index) => (
                <View key={owner.id} className={`${styles.ownerCard} ${index % 2 === 1 ? styles.ownerCardReverse : ''}`}>
                  <View className={`${styles.ownerAvatar} ${owner.id === 'owner-orange' ? styles.ownerAvatarOrange : styles.ownerAvatarXiaohei}`}>
                    <Text className={styles.ownerEmoji}>{owner.emoji}</Text>
                  </View>
                  <View className={styles.ownerBody}>
                    <Image
                      {...HOME_TEXT_IMAGE_PROPS}
                      className={`${styles.ownerLabel} ${owner.id === 'owner-orange' ? styles.ownerLabelOrange : styles.ownerLabelXiaohei}`}
                      src={owner.label}
                    />
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
