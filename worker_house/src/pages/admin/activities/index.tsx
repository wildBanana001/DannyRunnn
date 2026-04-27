import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Cell from '@nutui/nutui-react-taro/dist/es/packages/cell/index';
import CellGroup from '@nutui/nutui-react-taro/dist/es/packages/cellgroup/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { deleteAdminActivity, fetchAdminActivities } from '@/services/admin';
import type { Activity } from '@/types';
import styles from './index.module.scss';

const toastId = 'admin-activities-toast';

const AdminActivitiesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await fetchAdminActivities();
      setActivities(response.list);
    } catch (error) {
      const message = error instanceof Error ? error.message : '活动列表加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActivities();
  }, []);

  const handleEdit = (activity?: Activity) => {
    if (activity) {
      Taro.setStorageSync('worker-house-admin-activity', activity);
      Taro.navigateTo({ url: `/pages/admin/activity-edit/index?id=${activity.id}` });
      return;
    }

    Taro.removeStorageSync('worker-house-admin-activity');
    Taro.navigateTo({ url: '/pages/admin/activity-edit/index' });
  };

  const handleDelete = async (activity: Activity) => {
    const result = await Taro.showModal({
      title: '删除活动',
      content: `确认删除「${activity.title}」吗？`,
      confirmColor: '#E60000',
    });
    if (!result.confirm) {
      return;
    }

    try {
      await deleteAdminActivity(activity.id);
      Toast.show(toastId, { content: '活动已删除', icon: 'success' });
      await loadActivities();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>活动管理</Text>
        <Text className={styles.description}>当前共 {activities.length} 条活动，支持新增、编辑和删除。</Text>
        <View className={styles.headerActions}>
          <Button type="primary" onClick={() => handleEdit()}>新增活动</Button>
          <Button onClick={() => void loadActivities()}>刷新列表</Button>
        </View>
      </View>

      <View className={styles.listCard}>
        {loading ? (
          <Text className={styles.emptyText}>活动列表加载中…</Text>
        ) : activities.length === 0 ? (
          <Text className={styles.emptyText}>暂无活动，先创建一条吧。</Text>
        ) : (
          <CellGroup>
            {activities.map((activity) => (
              <View key={activity.id} className={styles.itemBlock}>
                <Cell
                  title={activity.title}
                  description={`${activity.startDate} ${activity.startTime}`}
                  extra={activity.status === 'ended' ? '已结束' : '进行中'}
                />
                <View className={styles.itemActions}>
                  <Button type="primary" onClick={() => handleEdit(activity)}>编辑</Button>
                  <Button onClick={() => void handleDelete(activity)}>删除</Button>
                </View>
              </View>
            ))}
          </CellGroup>
        )}
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminActivitiesPage;
