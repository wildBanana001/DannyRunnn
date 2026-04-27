import React from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { siteConfig } from '@/data/site';
import { useSiteConfig } from '@/shared/siteConfig';
import { useUserStore } from '@/store/userStore';
import styles from './index.module.scss';

const SettingsPage: React.FC = () => {
  const logout = useUserStore((state) => state.logout);
  const sharedSiteConfig = useSiteConfig();
  const aboutUs = sharedSiteConfig?.aboutUs || siteConfig.spaceDescription;

  const handleClearCache = async () => {
    await Taro.clearStorage();
    Taro.showToast({ title: '缓存已清理', icon: 'success' });
  };

  const handleAbout = async () => {
    await Taro.showModal({
      title: '关于我们',
      content: aboutUs || siteConfig.spaceDescription,
      showCancel: false,
      confirmColor: '#E60000'
    });
  };

  const handleLogout = async () => {
    const result = await Taro.showModal({
      title: '退出登录',
      content: '确认退出当前账号吗？',
      confirmColor: '#E60000'
    });

    if (!result.confirm) {
      return;
    }

    await Taro.clearStorage();
    logout();
    Taro.showToast({ title: '已退出登录', icon: 'success' });
    setTimeout(() => {
      Taro.switchTab({ url: '/pages/mine/index' });
    }, 300);
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.list}>
        <View className={styles.item} onClick={handleClearCache}>
          <Text className={styles.title}>清缓存</Text>
          <Text className={styles.arrow}>›</Text>
        </View>
        <View className={styles.item} onClick={handleAbout}>
          <Text className={styles.title}>关于我们</Text>
          <Text className={styles.arrow}>›</Text>
        </View>
        <View className={styles.item} onClick={handleLogout}>
          <Text className={styles.logoutTitle}>退出登录</Text>
          <Text className={styles.arrow}>›</Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default SettingsPage;
