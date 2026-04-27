import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Cell from '@nutui/nutui-react-taro/dist/es/packages/cell/index';
import CellGroup from '@nutui/nutui-react-taro/dist/es/packages/cellgroup/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import {
  deleteAdminPost,
  fetchAdminPosts,
  updateAdminPostPinned,
  type AdminMiniPost,
} from '@/services/admin';
import styles from './index.module.scss';

const toastId = 'admin-posts-toast';

function formatDateTime(value: string) {
  if (!value) {
    return '--';
  }
  return value.replace('T', ' ').slice(0, 16);
}

const AdminPostsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<AdminMiniPost[]>([]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await fetchAdminPosts();
      setPosts(response.list);
    } catch (error) {
      const message = error instanceof Error ? error.message : '帖子列表加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  const handleDelete = async (post: AdminMiniPost) => {
    const result = await Taro.showModal({
      title: '删除帖子',
      content: `确认删除「${post.title || '未命名留言'}」吗？`,
      confirmColor: '#E60000',
    });
    if (!result.confirm) {
      return;
    }

    try {
      await deleteAdminPost(post.id);
      Toast.show(toastId, { content: '帖子已删除', icon: 'success' });
      await loadPosts();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    }
  };

  const handleTogglePinned = async (post: AdminMiniPost) => {
    const nextPinned = !(post.isPinned ?? post.pinned);
    try {
      await updateAdminPostPinned(post.id, nextPinned);
      Toast.show(toastId, { content: nextPinned ? '帖子已置顶' : '帖子已取消置顶', icon: 'success' });
      await loadPosts();
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新置顶状态失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>留言墙管理</Text>
        <Text className={styles.description}>支持查看帖子、删除以及置顶管理。置顶帖子会排在最前面。</Text>
        <View className={styles.headerActions}>
          <Button type="primary" loading={loading} onClick={() => void loadPosts()}>{loading ? '刷新中…' : '刷新列表'}</Button>
        </View>
      </View>

      <View className={styles.listCard}>
        {loading ? (
          <Text className={styles.emptyText}>帖子列表加载中…</Text>
        ) : posts.length === 0 ? (
          <Text className={styles.emptyText}>暂无帖子</Text>
        ) : (
          <CellGroup>
            {posts.map((post) => {
              const pinned = post.isPinned ?? post.pinned;
              return (
                <View key={post.id} className={styles.itemBlock}>
                  <Cell
                    title={post.title || '未命名留言'}
                    description={`${post.authorNickname || '匿名用户'} · ${formatDateTime(post.createdAt)}`}
                    extra={pinned ? '已置顶' : '普通'}
                  />
                  <Text className={styles.content}>{post.content || '暂无正文'}</Text>
                  <Text className={styles.meta}>点赞 {post.likes} · 评论 {post.commentsCount ?? post.comments ?? 0}</Text>
                  <View className={styles.itemActions}>
                    <Button type="primary" onClick={() => void handleTogglePinned(post)}>{pinned ? '取消置顶' : '置顶'}</Button>
                    <Button onClick={() => void handleDelete(post)}>删除</Button>
                  </View>
                </View>
              );
            })}
          </CellGroup>
        )}
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminPostsPage;
