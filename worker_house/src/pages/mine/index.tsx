import React, { useCallback, useRef, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useTabItemTap } from '@tarojs/taro';
import { ArrowRight, Articles, Coupon, Edit, Location, Order, Setting } from '@nutui/icons-react-taro';
import WxLoginModal from '@/components/WxLoginModal';
import SafeImage from '@/components/SafeImage';
import { siteConfig } from '@/data/site';
import { fetchMemberOverview, type MemberOverview } from '@/services/member';
import { fetchAdminIdentity } from '@/services/adminFulfillment';
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

const adminMenuItem = {
  key: 'admin-fulfillments',
  icon: Order,
  title: '待核销订单',
  description: '管理员专用 · 到店核销并自动同步微信',
  url: '/pages/content/admin-fulfillments/index',
  requiresLogin: true,
  wallOnly: false,
} as const;

type MineMenuItem = (typeof menuItems)[number] | typeof adminMenuItem;

const MINE_TAB_REVEAL_WINDOW_MS = 1200;

const defaultOverview: MemberOverview = {
  registrationsCount: 0,
  remainingCardTimes: 0,
  likesReceived: 0,
};

const MinePage: React.FC = () => {
  const { user, isLoggedIn, refreshWxMe } = useUserStore();
  const [overview, setOverview] = useState<MemberOverview>(defaultOverview);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const mineTabTapRef = useRef({ count: 0, startedAt: 0 });
  const sharedSiteConfig = useSiteConfig();
  const viewportStyle = useViewportLayout({ fallbackTopGapRpx: 50, reserveH5TabBar: true });

  const loadMineData = useCallback(async () => {
    const loggedIn = useUserStore.getState().isLoggedIn;
    if (!loggedIn) {
      setOverview(defaultOverview);
      setIsAdmin(false);
      return;
    }

    void refreshWxMe();
    const [overviewResult, adminResult] = await Promise.allSettled([
      fetchMemberOverview(),
      fetchAdminIdentity(),
    ]);

    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value);
    } else {
      console.warn('[mine] overview load failed', overviewResult.reason);
    }

    if (adminResult.status === 'fulfilled') {
      setIsAdmin(adminResult.value.isAdmin);
    } else {
      setIsAdmin(false);
      console.warn('[mine] admin identity load failed', adminResult.reason);
    }
  }, [refreshWxMe]);

  useDidShow(() => {
    void loadMineData();
  });

  const revealCurrentOpenid = useCallback(async () => {
    if (!useUserStore.getState().isLoggedIn) {
      Taro.showToast({ title: '请先登录后获取管理员 ID', icon: 'none' });
      setLoginModalVisible(true);
      return;
    }

    let openid = '';
    try {
      const identity = await fetchAdminIdentity();
      openid = identity.openid.trim();
    } catch (error) {
      console.warn('[mine] admin openid load failed', error);
      Taro.showToast({ title: '管理员 ID 获取失败，请稍后重试', icon: 'none' });
      return;
    }

    if (!openid) {
      Taro.showToast({ title: '暂时无法获取 OpenID，请稍后重试', icon: 'none' });
      return;
    }

    let result: Taro.showModal.SuccessCallbackResult;
    try {
      result = await Taro.showModal({
        title: '当前小程序管理员 ID',
        content: `${openid}\n\n这是当前微信账号在本小程序中的 OpenID，可复制后加入服务端管理员白名单。`,
        confirmText: '复制 ID',
        cancelText: '关闭',
      });
    } catch {
      // H5 关闭原生确认框时会 reject；用户取消不需要额外提示。
      return;
    }
    if (!result.confirm) return;

    try {
      await Taro.setClipboardData({ data: openid });
      Taro.showToast({ title: '管理员 ID 已复制', icon: 'success' });
    } catch (error) {
      console.warn('[mine] copy openid failed', error);
      Taro.showToast({ title: '复制失败，请长按 ID 手动复制', icon: 'none' });
    }
  }, []);

  useTabItemTap(() => {
    const now = Date.now();
    const tapState = mineTabTapRef.current;
    if (!tapState.startedAt || now - tapState.startedAt > MINE_TAB_REVEAL_WINDOW_MS) {
      mineTabTapRef.current = { count: 1, startedAt: now };
      return;
    }

    const nextCount = tapState.count + 1;
    if (nextCount < 3) {
      mineTabTapRef.current = { ...tapState, count: nextCount };
      return;
    }

    mineTabTapRef.current = { count: 0, startedAt: 0 };
    void revealCurrentOpenid();
  });

  const handleMenuClick = (item: MineMenuItem) => {
    if (item.requiresLogin && !isLoggedIn) {
      Taro.showToast({ title: '请先登录再查看', icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: item.url });
  };

  const visibleMenuItems = menuItems.reduce<MineMenuItem[]>((items, item) => {
    if (item.wallOnly && !sharedSiteConfig.communityWallEnabled) {
      return items;
    }
    items.push(item);
    if (item.key === 'registrations' && isAdmin) {
      items.push(adminMenuItem);
    }
    return items;
  }, []);

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
        {visibleMenuItems.map((item) => {
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

      <View className={styles.bottomSpacing} />
      <WxLoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
        onSuccess={() => {
          setLoginModalVisible(false);
          void loadMineData();
        }}
      />
    </ScrollView>
  );
};

export default MinePage;
