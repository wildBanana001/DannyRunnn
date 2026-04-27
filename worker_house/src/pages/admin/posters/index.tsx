import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import {
  deleteAdminPoster,
  fetchAdminPosters,
  updateAdminPosterStatus,
  type AdminMiniPoster,
} from '@/services/admin';
import styles from './index.module.scss';

const toastId = 'admin-posters-toast';
const posterStorageKey = 'worker-house-admin-poster';

function formatDateTime(value: string) {
  if (!value) {
    return '--';
  }
  return value.replace('T', ' ').slice(0, 16);
}

const AdminPostersPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [posters, setPosters] = useState<AdminMiniPoster[]>([]);

  const loadPosters = async () => {
    setLoading(true);
    try {
      const response = await fetchAdminPosters();
      setPosters(response.list);
    } catch (error) {
      const message = error instanceof Error ? error.message : '海报列表加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosters();
  }, []);

  const handleEdit = (poster?: AdminMiniPoster) => {
    if (poster) {
      Taro.setStorageSync(posterStorageKey, poster);
      Taro.navigateTo({ url: `/pages/admin/poster-edit/index?id=${poster.id}` });
      return;
    }

    Taro.removeStorageSync(posterStorageKey);
    Taro.navigateTo({ url: '/pages/admin/poster-edit/index' });
  };

  const handleDelete = async (poster: AdminMiniPoster) => {
    const result = await Taro.showModal({
      title: '删除海报',
      content: `确认删除「${poster.title}」吗？`,
      confirmColor: '#E60000',
    });
    if (!result.confirm) {
      return;
    }

    try {
      await deleteAdminPoster(poster.id);
      Toast.show(toastId, { content: '海报已删除', icon: 'success' });
      await loadPosters();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    }
  };

  const handleToggleStatus = async (poster: AdminMiniPoster) => {
    const nextStatus = poster.status === 'online' ? 'offline' : 'online';
    try {
      await updateAdminPosterStatus(poster.id, nextStatus);
      Toast.show(toastId, { content: nextStatus === 'online' ? '海报已上架' : '海报已下架', icon: 'success' });
      await loadPosters();
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新状态失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>海报管理</Text>
        <Text className={styles.description}>支持新增、编辑、删除和上下架，字段精简为手机端可操作的最小集合。</Text>
        <View className={styles.headerActions}>
          <Button type="primary" onClick={() => handleEdit()}>新增海报</Button>
          <Button onClick={() => void loadPosters()}>{loading ? '刷新中…' : '刷新列表'}</Button>
        </View>
      </View>

      <View className={styles.listCard}>
        {loading ? (
          <Text className={styles.emptyText}>海报列表加载中…</Text>
        ) : posters.length === 0 ? (
          <Text className={styles.emptyText}>暂无海报</Text>
        ) : (
          posters.map((poster) => (
            <View key={poster.id} className={styles.itemCard}>
              {poster.coverImage ? <Image className={styles.coverImage} src={poster.coverImage} mode="aspectFill" /> : null}
              <Text className={styles.itemTitle}>{poster.title}</Text>
              <Text className={styles.itemMeta}>状态：{poster.status === 'online' ? '上架中' : '已下架'} · 创建于 {formatDateTime(poster.createdAt)}</Text>
              <Text className={styles.itemMeta}>关联活动：{poster.relatedActivityId || '未关联'}</Text>
              <Text className={styles.linkText}>{poster.linkUrl || '未设置跳转链接'}</Text>
              <View className={styles.itemActions}>
                <Button type="primary" onClick={() => handleEdit(poster)}>编辑</Button>
                <Button onClick={() => void handleToggleStatus(poster)}>{poster.status === 'online' ? '下架' : '上架'}</Button>
                <Button onClick={() => void handleDelete(poster)}>删除</Button>
              </View>
            </View>
          ))
        )}
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminPostersPage;
