import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Cell from '@nutui/nutui-react-taro/dist/es/packages/cell/index';
import CellGroup from '@nutui/nutui-react-taro/dist/es/packages/cellgroup/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { deleteAdminStory, fetchAdminStories, type AdminMiniStory } from '@/services/admin';
import { formatDate } from '@/utils/helpers';
import styles from './index.module.scss';

const toastId = 'admin-stories-toast';
const storyStorageKey = 'worker-house-admin-story';

const AdminStoriesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<AdminMiniStory[]>([]);

  const loadStories = async () => {
    setLoading(true);
    try {
      const response = await fetchAdminStories();
      setStories(response.list);
    } catch (error) {
      const message = error instanceof Error ? error.message : '故事列表加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStories();
  }, []);

  const handleEdit = (story?: AdminMiniStory) => {
    if (story) {
      Taro.setStorageSync(storyStorageKey, story);
      Taro.navigateTo({ url: `/pages/admin/story-edit/index?id=${story.id}` });
      return;
    }

    Taro.removeStorageSync(storyStorageKey);
    Taro.navigateTo({ url: '/pages/admin/story-edit/index' });
  };

  const handleDelete = async (story: AdminMiniStory) => {
    const result = await Taro.showModal({
      title: '删除故事',
      content: `确认删除「${story.title}」吗？`,
      confirmColor: '#E60000',
    });
    if (!result.confirm) {
      return;
    }

    try {
      await deleteAdminStory(story.id);
      Toast.show(toastId, { content: '故事已删除', icon: 'success' });
      await loadStories();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>社畜故事管理</Text>
        <Text className={styles.description}>当前共 {stories.length} 条故事，支持新增、编辑和删除。</Text>
        <View className={styles.headerActions}>
          <Button type="primary" onClick={() => handleEdit()}>新增故事</Button>
          <Button onClick={() => void loadStories()}>刷新列表</Button>
        </View>
      </View>

      <View className={styles.listCard}>
        {loading ? (
          <Text className={styles.emptyText}>故事列表加载中…</Text>
        ) : stories.length === 0 ? (
          <Text className={styles.emptyText}>暂无故事，先创建一条吧。</Text>
        ) : (
          <CellGroup>
            {stories.map((story) => (
              <View key={story.id} className={styles.itemBlock}>
                <Cell
                  title={story.title}
                  description={`${story.author || '社畜空间'} · ${formatDate(story.publishAt)}`}
                  extra={story.sourceUrl ? '🔗 公众号' : '仅站内'}
                />
                <Text className={styles.itemExcerpt}>{story.excerpt || '暂无摘要'}</Text>
                <View className={styles.itemActions}>
                  <Button type="primary" onClick={() => handleEdit(story)}>编辑</Button>
                  <Button onClick={() => void handleDelete(story)}>删除</Button>
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

export default AdminStoriesPage;
