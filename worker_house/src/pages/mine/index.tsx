import React, { useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { siteConfig } from '@/data/site';
import { checkMiniAdmin } from '@/services/admin';
import { fetchMemberOverview, type MemberOverview } from '@/services/member';
import { useUserStore } from '@/store/userStore';
import avatarFrame from '@/assets/illustrations/avatar-frame.png';
import cloudImage from '@/assets/illustrations/cloud.png';
import styles from './index.module.scss';

const menuItems = [
  { key: 'registrations', icon: '📅', title: '我的报名', description: '查看报名与支付快照', url: '/pages/content/my-registrations/index' },
  { key: 'profiles', icon: '🧾', title: '我的档案', description: '新建、编辑、设默认社畜档案', url: '/pages/my-profiles/index' },
  { key: 'cards', icon: '🎟️', title: '社畜次卡', description: '看余量、买次卡、查使用记录', url: '/pages/my-cards/index' },
  { key: 'posts', icon: '📝', title: '我的帖子', description: '回看留在墙上的便利贴', url: '/pages/content/my-posts/index' },
  { key: 'addresses', icon: '📍', title: '地址管理', description: '管理收件地址和默认信息', url: '/pages/my-addresses/index' },
  { key: 'settings', icon: '⚙️', title: '设置', description: '清缓存、关于我们、退出登录', url: '/pages/settings/index' }
] as const;

const defaultOverview: MemberOverview = {
  registrationsCount: 0,
  postsCount: 0,
  remainingCardTimes: 0,
  likesReceived: 0,
};

const MinePage: React.FC = () => {
  const { user, isLoggedIn, refreshWxMe } = useUserStore();
  const [overview, setOverview] = useState<MemberOverview>(defaultOverview);
  const [isAdmin, setIsAdmin] = useState(false);


  useDidShow(() => {
    if (!useUserStore.getState().isLoggedIn) {
      Taro.switchTab({ url: '/pages/home/index' });
      return;
    }

    // 管理员身份校验：只有命中 BFF 白名单（ADMIN_OPENID_WHITELIST）的 openid
    // 才会把"管理员入口"渲染出来；未命中 / 未登录 / 接口失败都视为非管理员。
    checkMiniAdmin()
      .then((result) => setIsAdmin(Boolean(result?.isAdmin)))
      .catch((error) => {
        console.warn('[mine] admin check failed', error);
        setIsAdmin(false);
      });

    // 登录态下进入页面时刷新一次后端用户信息（非阻塞）
    refreshWxMe();

    if (!isLoggedIn) {
      return;
    }

    fetchMemberOverview()
      .then((result) => setOverview(result))
      .catch((error) => {
        console.warn('[mine] overview load failed', error);
      });
  });

  const handleMenuClick = (url: string) => {
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录再查看', icon: 'none' });
      return;
    }
    Taro.navigateTo({ url });
  };

  const handleOpenAdmin = () => {
    Taro.navigateTo({ url: '/pages/admin/index/index' });
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.header}>
        <Image className={styles.cloudLeft} src={cloudImage} mode="widthFix" />
        <Image className={styles.cloudRight} src={cloudImage} mode="widthFix" />
        <View className={styles.userCard}>
          <View className={styles.avatarWrap}>
            <Image className={styles.avatarFrame} src={avatarFrame} mode="aspectFit" />
            <Image className={styles.avatar} src={user?.avatar || siteConfig.ownerAvatar} mode="aspectFill" />
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

      <View className={styles.statsCard}>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{overview.registrationsCount}</Text>
          <Text className={styles.statLabel}>报名</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{overview.postsCount}</Text>
          <Text className={styles.statLabel}>帖子</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{overview.remainingCardTimes}</Text>
          <Text className={styles.statLabel}>次卡余量</Text>
        </View>
      </View>

      <View className={styles.menuList}>
        {menuItems.map((item) => (
          <View key={item.key} className={styles.menuItem} onClick={() => handleMenuClick(item.url)}>
            <View className={styles.menuMeta}>
              <Text className={styles.menuIcon}>{item.icon}</Text>
              <View>
                <Text className={styles.menuTitle}>{item.title}</Text>
                <Text className={styles.menuDescription}>{item.description}</Text>
              </View>
            </View>
            <Text className={styles.menuArrow}>›</Text>
          </View>
        ))}
      </View>

      {isAdmin ? (
        <View className={styles.adminEntryWrap}>
          <Text className={styles.adminEntry} onClick={handleOpenAdmin}>管理员入口</Text>
        </View>
      ) : null}

      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default MinePage;
