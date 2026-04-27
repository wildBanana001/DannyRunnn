import React from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { currentUser, userRegistrations, userStats } from '@/data/users';
import { formatPrice, getRegistrationStatusText, getRegistrationStatusColor } from '@/utils/helpers';
import styles from './index.module.scss';

const menuItems = [
  { icon: '📅', label: '我的报名', action: 'registrations' },
  { icon: '📝', label: '我的帖子', action: 'posts' },
  { icon: '📍', label: '地址管理', action: 'addresses' },
  { icon: '⚙️', label: '设置', action: 'settings' }
];

const ProfilePage: React.FC = () => {
  const handleMenuClick = (action: string) => {
    Taro.showToast({
      title: `${menuItems.find(item => item.action === action)?.label}功能开发中`,
      icon: 'none'
    });
  };

  const handleRegistrationClick = (activityId: string) => {
    Taro.navigateTo({
      url: `/pages/content/activity-detail/index?id=${activityId}`
    });
  };

  return (
    <ScrollView
      className={styles.container}
      scrollY
      enableFlex
    >
      {/* User Header */}
      <View className={styles.userHeader}>
        <View className={styles.userInfo}>
          <Image
            className={styles.avatar}
            src={currentUser.avatar || 'https://picsum.photos/id/64/200/200'}
            mode="aspectFill"
          />
          <View className={styles.userMeta}>
            <Text className={styles.nickname}>{currentUser.nickname}</Text>
            <Text className={styles.userId}>ID: {currentUser.id}</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View className={styles.statsCard}>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{userStats.registrationsCount}</Text>
          <Text className={styles.statLabel}>报名活动</Text>
        </View>
        <View className={styles.statDivider} />
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{userStats.attendedCount}</Text>
          <Text className={styles.statLabel}>已参加</Text>
        </View>
        <View className={styles.statDivider} />
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{userStats.postsCount}</Text>
          <Text className={styles.statLabel}>发布帖子</Text>
        </View>
        <View className={styles.statDivider} />
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{userStats.likesReceived}</Text>
          <Text className={styles.statLabel}>获赞</Text>
        </View>
      </View>

      {/* Recent Registrations */}
      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>最近报名</Text>
          <Text
            className={styles.sectionMore}
            onClick={() => handleMenuClick('registrations')}
          >
            查看全部
          </Text>
        </View>

        <View className={styles.registrationsList}>
          {userRegistrations.slice(0, 3).map((registration) => (
            <View
              key={registration.id}
              className={styles.registrationItem}
              onClick={() => handleRegistrationClick(registration.activityId)}
            >
              <Image
                className={styles.registrationImage}
                src={registration.activityCover}
                mode="aspectFill"
              />
              <View className={styles.registrationInfo}>
                <Text className={styles.registrationTitle}>
                  {registration.activityTitle}
                </Text>
                <Text className={styles.registrationPrice}>
                  费用：{formatPrice(registration.paymentAmount)}（加微信缴费）
                </Text>
              </View>
              <View
                className={styles.registrationStatus}
                style={{ backgroundColor: `${getRegistrationStatusColor(registration.status)}20` }}
              >
                <Text
                  className={styles.registrationStatusText}
                  style={{ color: getRegistrationStatusColor(registration.status) }}
                >
                  {getRegistrationStatusText(registration.status)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Menu */}
      <View className={styles.section}>
        <View className={styles.menuGrid}>
          {menuItems.map((item) => (
            <View
              key={item.action}
              className={styles.menuItem}
              onClick={() => handleMenuClick(item.action)}
            >
              <Text className={styles.menuIcon}>{item.icon}</Text>
              <Text className={styles.menuLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom Spacing */}
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default ProfilePage;
