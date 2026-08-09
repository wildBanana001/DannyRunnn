import React, { useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { ArrowRight, Articles, Coupon, Edit, Location, Order, Setting } from '@nutui/icons-react-taro';
import WxLoginModal from '@/components/WxLoginModal';
import SafeImage from '@/components/SafeImage';
import { siteConfig } from '@/data/site';
import { checkMiniAdmin } from '@/services/admin';
import { fetchMemberOverview, type MemberOverview } from '@/services/member';
import { getApiMode } from '@/services/request';
import { useSiteConfig } from '@/shared/siteConfig';
import { useUserStore } from '@/store/userStore';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import avatarFrame from '@/assets/illustrations/avatar-frame.png';
import defaultAvatar from '@/assets/home/hero-cover.jpg';
import styles from './index.module.scss';

const menuItems = [
  { key: 'wall', icon: Edit, title: '留言墙', description: '看看大家留下的便利贴', url: '/pages/wall/index', requiresLogin: false, wallOnly: true },
  { key: 'posts', icon: Edit, title: '我的留言', description: '回看自己留在墙上的内容', url: '/pages/content/my-posts/index', requiresLogin: true, wallOnly: true },
  { key: 'registrations', icon: Order, title: '我的报名', description: '查看报名与支付快照', url: '/pages/content/my-registrations/index', requiresLogin: true, wallOnly: false },
  { key: 'profiles', icon: Articles, title: '我的档案', description: '新建、编辑、设默认社畜档案', url: '/pages/my-profiles/index', requiresLogin: true, wallOnly: false },
  { key: 'cards', icon: Coupon, title: '社畜次卡', description: '看余量、买次卡、查使用记录', url: '/pages/my-cards/index', requiresLogin: true, wallOnly: false },
  { key: 'addresses', icon: Location, title: '地址管理', description: '管理收件地址和默认信息', url: '/pages/my-addresses/index', requiresLogin: true, wallOnly: false },
  { key: 'settings', icon: Setting, title: '设置', description: '清缓存、关于我们、退出登录', url: '/pages/settings/index', requiresLogin: true, wallOnly: false }
] as const;

const defaultOverview: MemberOverview = {
  registrationsCount: 0,
  remainingCardTimes: 0,
  likesReceived: 0,
};

const MinePage: React.FC = () => {
  const { user, isLoggedIn, refreshWxMe } = useUserStore();
  const [overview, setOverview] = useState<MemberOverview>(defaultOverview);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const sharedSiteConfig = useSiteConfig();
  const viewportStyle = useViewportLayout({ fallbackTopGapRpx: 50, reserveH5TabBar: true });

  useDidShow(() => {
    const loggedIn = useUserStore.getState().isLoggedIn;
    if (!loggedIn) {
      setOverview(defaultOverview);
      setIsAdmin(false);
      return;
    }

    // 管理员身份校验：只有命中 BFF 白名单（ADMIN_OPENID_WHITELIST）的 openid
    // 才会把"管理员入口"渲染出来；未命中 / 未登录 / 接口失败都视为非管理员。
    if (getApiMode() === 'mock') {
      setIsAdmin(false);
    } else {
      checkMiniAdmin()
        .then((result) => setIsAdmin(Boolean(result?.isAdmin)))
        .catch((error) => {
          console.warn('[mine] admin check failed', error);
          setIsAdmin(false);
        });
    }

    // 登录态下进入页面时刷新一次后端用户信息（非阻塞）
    refreshWxMe();

    fetchMemberOverview()
      .then((result) => setOverview(result))
      .catch((error) => {
        console.warn('[mine] overview load failed', error);
      });
  });

  const handleMenuClick = (item: (typeof menuItems)[number]) => {
    if (item.requiresLogin && !isLoggedIn) {
      Taro.showToast({ title: '请先登录再查看', icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: item.url });
  };

  const handleOpenAdmin = () => {
    Taro.navigateTo({ url: '/pages/admin/index/index' });
  };

  return (
    <ScrollView className={styles.container} style={viewportStyle} scrollY enableFlex>
      <View className={styles.header}>
        <Text className={styles.eyebrow}>MY WORKER HOUSE</Text>
        <Text className={styles.pageTitle}>我的社畜角落</Text>
        <View className={styles.userCard}>
          <View className={styles.avatarWrap}>
            <Image className={styles.avatarFrame} src={avatarFrame} mode="aspectFit" />
            <SafeImage
              className={styles.avatar}
              src={user?.avatar || siteConfig.ownerAvatar || defaultAvatar}
              fallbackSrc={defaultAvatar}
              fallbackDelayMs={1800}
              mode="aspectFill"
            />
          </View>
          <View className={styles.userMeta}>
            <Text className={styles.nickname}>{user?.nickname || '未登录用户'}</Text>
            <Text className={styles.tip}>
              {isLoggedIn
                ? `默认档案：${overview.defaultProfileName || '还没创建'}，今晚也要给自己留一点松弛感。`
                : '先登录，再把喜欢的活动、档案和次卡都留在这里。'}
            </Text>
          </View>
        </View>
      </View>

      {!isLoggedIn ? (
        <View className={styles.loginWrap}>
          <View className={styles.loginButton} onClick={() => setLoginModalVisible(true)}>
            <Text className={styles.loginButtonText}>微信登录</Text>
          </View>
        </View>
      ) : null}

      <View className={styles.statsCard}>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{overview.registrationsCount}</Text>
          <Text className={styles.statLabel}>报名</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{overview.remainingCardTimes}</Text>
          <Text className={styles.statLabel}>次卡余量</Text>
        </View>
      </View>

      <View className={styles.menuList}>
        {menuItems.filter((item) => !item.wallOnly || sharedSiteConfig.communityWallEnabled).map((item) => {
          const MenuIcon = item.icon;
          return (
            <View key={item.key} className={styles.menuItem} onClick={() => handleMenuClick(item)}>
              <View className={styles.menuMeta}>
                <MenuIcon className={styles.menuIcon} size="21" />
                <View>
                  <Text className={styles.menuTitle}>{item.title}</Text>
                  <Text className={styles.menuDescription}>{item.description}</Text>
                </View>
              </View>
              <ArrowRight className={styles.menuArrow} size="17" />
            </View>
          );
        })}
      </View>

      {isAdmin ? (
        <View className={styles.adminEntryWrap}>
          <Text className={styles.adminEntry} onClick={handleOpenAdmin}>管理员入口</Text>
        </View>
      ) : null}

      <View className={styles.bottomSpacing} />
      <WxLoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
        onSuccess={() => setLoginModalVisible(false)}
      />
    </ScrollView>
  );
};

export default MinePage;
