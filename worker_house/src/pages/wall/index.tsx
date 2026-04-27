import React, { useEffect, useMemo, useState } from 'react';
import { Input, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { commentWallPost, fetchPostDetail, fetchPostList } from '@/cloud/services';
import { useUserStore } from '@/store/userStore';
import type { Comment, Post } from '@/types/post';
import { estimatePostHeight, getFixedTilt, matchPostKeyword } from '@/utils/helpers';
import NoteCard from './components/NoteCard';
import PostModal from './components/PostModal';
import styles from './index.module.scss';

interface PostDetailState {
  post: Post;
  comments: Comment[];
}

const MODAL_ANIMATION_DURATION = 280;

const WallPage: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [detail, setDetail] = useState<PostDetailState | null>(null);
  const [modalState, setModalState] = useState<'hidden' | 'opening' | 'closing'>('hidden');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  const loadPosts = async () => {
    const list = await fetchPostList();
    setPosts(list);
  };

  useDidShow(() => {
    if (!useUserStore.getState().isLoggedIn) {
      Taro.switchTab({ url: '/pages/home/index' });
      return;
    }
    loadPosts();
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchKeyword(searchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const filteredPosts = useMemo(() => posts.filter((post) => matchPostKeyword(post, searchKeyword)), [posts, searchKeyword]);

  const columns = useMemo(() => {
    const left: Array<{ post: Post; index: number }> = [];
    const right: Array<{ post: Post; index: number }> = [];
    let leftHeight = 0;
    let rightHeight = 0;

    filteredPosts.forEach((post, index) => {
      const item = { post, index };
      const currentHeight = estimatePostHeight(post);
      if (leftHeight <= rightHeight) {
        left.push(item);
        leftHeight += currentHeight;
      } else {
        right.push(item);
        rightHeight += currentHeight;
      }
    });

    return [left, right] as const;
  }, [filteredPosts]);

  const handleFavorite = () => {
    Taro.showToast({ title: '已收藏', icon: 'none' });
  };

  const handleOpenDetail = async (post: Post) => {
    setDetail({ post, comments: [] });
    setModalState('opening');
    setCommentText('');

    try {
      const postDetail = await fetchPostDetail(post.id);
      setDetail((current) => (current?.post.id === post.id ? postDetail : current));
    } catch (error) {
      console.warn('[wall] 加载详情失败', error);
      Taro.showToast({ title: '留言详情加载失败', icon: 'none' });
    }
  };

  const handleCloseDetail = () => {
    setModalState('closing');
    setTimeout(() => {
      setModalState('hidden');
      setDetail(null);
      setCommentText('');
    }, MODAL_ANIMATION_DURATION);
  };

  const handleSubmitComment = async () => {
    if (!detail || !commentText.trim()) {
      return;
    }

    setIsSubmitting(true);
    const newComment = await commentWallPost(detail.post.id, commentText.trim());
    const updatedPost: Post = {
      ...detail.post,
      comments: detail.post.comments + 1,
      commentsCount: (detail.post.commentsCount ?? detail.post.comments) + 1
    };

    setDetail({
      post: updatedPost,
      comments: [newComment, ...detail.comments]
    });
    setPosts((current) => current.map((item) => (item.id === updatedPost.id ? updatedPost : item)));
    setCommentText('');
    setIsSubmitting(false);
    Taro.showToast({ title: '评论成功', icon: 'success' });
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <View>
          <Text className={`${styles.title} font-display`}>留言墙</Text>
          <Text className={styles.subtitle}>把今天想说的话贴在这里，慢慢被看见。</Text>
        </View>
        <View className={styles.publishButton} onClick={() => Taro.navigateTo({ url: '/pages/content/wall-publish/index' })}>
          <Text className={styles.publishText}>发布</Text>
        </View>
      </View>

      <View className={styles.searchBar}>
        <Text className={styles.searchIcon}>⌕</Text>
        <Input
          className={styles.searchInput}
          placeholder="搜索留言..."
          value={searchInput}
          onInput={(event) => setSearchInput(event.detail.value)}
        />
      </View>

      {!!searchKeyword && (
        <Text className={styles.searchResult}>共找到 {filteredPosts.length} 条和“{searchKeyword}”相关的留言</Text>
      )}

      <View className={styles.columns}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex === 0 ? 'left-column' : 'right-column'} className={styles.column}>
            {column.map(({ post, index }) => (
              <NoteCard
                key={post.id}
                post={post}
                tilt={getFixedTilt(index)}
                onClick={handleOpenDetail}
                onLike={handleFavorite}
              />
            ))}
          </View>
        ))}
      </View>

      <PostModal
        visible={modalState !== 'hidden' && !!detail}
        state={modalState === 'closing' ? 'closing' : 'opening'}
        post={detail?.post || null}
        comments={detail?.comments || []}
        commentText={commentText}
        onCommentChange={setCommentText}
        onClose={handleCloseDetail}
        onSubmitComment={handleSubmitComment}
        onLike={handleFavorite}
        isSubmitting={isSubmitting}
      />
    </View>
  );
};

export default WallPage;
