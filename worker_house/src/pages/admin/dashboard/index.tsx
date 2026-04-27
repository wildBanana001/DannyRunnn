import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { fetchAdminStats, type AdminStatsResult } from '@/services/admin';
import styles from './index.module.scss';

const toastId = 'admin-dashboard-toast';

const emptyStats: AdminStatsResult = {
  activities: { total: 0, ongoing: 0, ended: 0 },
  posts: { total: 0 },
  registrations: { total: 0 },
  cardOrders: { total: 0 },
};

const AdminDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStatsResult>(emptyStats);

  const loadStats = async () => {
    setLoading(true);
    try {
      const nextStats = await fetchAdminStats();
      setStats(nextStats);
    } catch (error) {
      const message = error instanceof Error ? error.message : '统计数据加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const cards = useMemo(
    () => [
      { label: '活动总数', value: stats.activities.total },
      { label: '进行中活动', value: stats.activities.ongoing },
      { label: '已结束活动', value: stats.activities.ended },
      { label: '树洞帖子数', value: stats.posts.total },
      { label: '报名总数', value: stats.registrations.total },
      { label: '次卡订单总数', value: stats.cardOrders.total },
    ],
    [stats],
  );

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>Dashboard</Text>
        <Text className={styles.description}>聚合查看活动、帖子、报名和次卡订单数据，适合手机上快速巡检。</Text>
        <View className={styles.headerActions}>
          <Button type="primary" loading={loading} onClick={() => void loadStats()}>{loading ? '刷新中…' : '刷新数据'}</Button>
        </View>
      </View>

      <View className={styles.gridCard}>
        <View className={styles.grid}>
          {cards.map((item) => (
            <View key={item.label} className={styles.statCard}>
              <Text className={styles.statLabel}>{item.label}</Text>
              <Text className={styles.statValue}>{loading ? '--' : item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminDashboardPage;
