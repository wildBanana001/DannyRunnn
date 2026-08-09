import React, { useCallback, useEffect, useState } from 'react';
import { Input, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import CommunityWallUnavailable from '@/components/CommunityWallUnavailable';
import EmptyState from '@/components/EmptyState';
import SafeImage from '@/components/SafeImage';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import avatarFallback from '@/assets/illustrations/avatar-frame.png';
import { commentWallPost, fetchPostDetail } from '@/cloud/services';
import { previewPostImage } from '@/services/postImages';
import { useCommunityWallFeature } from '@/shared/siteConfig';
import type { Comment, Post } from '@/types/post';
import { formatDateTime, getPostCommentCount, getRelativeTime } from '@/utils/helpers';
import styles from './index.module.scss';

const PostDetailPage: React.FC = () => {
  const wallFeature = useCommunityWallFeature();
  const router = useRouter();
  const postId = router.params.id?.trim() || '';
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const viewportStyle = useViewportLayout();

  const loadPost = useCallback(async () => {
    if (!postId) {
      setPost(null);
      setErrorMessage('缺少帖子信息');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await fetchPostDetail(postId);
      if (result.post.id !== postId) {
        throw new Error('帖子信息不匹配');
      }
      setPost(result.post);
      setComments(result.comments);
    } catch (error) {
      setPost(null);
      setComments([]);
      setErrorMessage(error instanceof Error ? error.message : '帖子加载失败');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!wallFeature.loading && wallFeature.enabled) {
      void loadPost();
    }
  }, [loadPost, wallFeature.enabled, wallFeature.loading]);

  const handleLike = () => {
    Taro.showToast({ title: '已收藏', icon: 'none' });
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !post) {
      return;
    }

    setIsSubmitting(true);
    try {
      const newComment = await commentWallPost(post.id, commentText.trim());
      setComments((current) => [newComment, ...current]);
      setPost((current) => current ? {
        ...current,
        comments: current.comments + 1,
        commentsCount: (current.commentsCount ?? current.comments) + 1,
      } : current);
      setCommentText('');
      Taro.showToast({ title: '评论成功', icon: 'success' });
    } catch (error) {
      console.warn('[post-detail] comment failed', error);
      Taro.showToast({ title: '评论发送失败，请稍后再试', icon: 'none' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (wallFeature.loading || !wallFeature.enabled) {
    return <CommunityWallUnavailable loading={wallFeature.loading} />;
  }

  if (loading) {
    return (
      <View className={styles.container} style={viewportStyle}>
        <Text className={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (!post || errorMessage) {
    return (
      <View className={styles.container} style={viewportStyle}>
        <EmptyState title="没有找到这条留言" description={errorMessage || '帖子可能已被删除。'}>
          <Button block type="outline" onClick={() => void loadPost()}>重新加载</Button>
        </EmptyState>
      </View>
    );
  }

  return (
    <View className={styles.container} style={viewportStyle}>
      <ScrollView className={styles.scrollView} scrollY enableFlex>
        <View className={styles.postCard}>
          <View className={styles.header}>
            {post.isAnonymous ? (
              <View className={styles.anonymousAvatar}>
                <Text className={styles.anonymousText}>匿</Text>
              </View>
            ) : (
              <SafeImage className={styles.avatar} src={post.authorAvatar} fallbackSrc={avatarFallback} mode="aspectFill" />
            )}
            <View className={styles.authorInfo}>
              <Text className={styles.nickname}>{post.isAnonymous ? '匿名留言' : post.authorNickname}</Text>
              <Text className={styles.time}>{getRelativeTime(post.createdAt)}</Text>
            </View>
          </View>

          <Text className={styles.title}>{post.title}</Text>
          <Text className={styles.content}>{post.content}</Text>

        {post.images.length > 0 && (
          <View className={styles.images}>
            {post.images.map((image, index) => (
              <SafeImage
                key={image}
                className={styles.image}
                src={image}
                mode="aspectFill"
                onClick={() => void previewPostImage(post, index)}
              />
            ))}
          </View>
        )}

          {post.tags.length > 0 && (
            <View className={styles.tags}>
              {post.tags.map((tag) => (
                <View key={tag} className={styles.tag}>
                  <Text className={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View className={styles.footer}>
            <View className={styles.action} onClick={handleLike}>
              <Text className={styles.actionIcon}>❤️</Text>
              <Text className={styles.actionText}>收藏</Text>
            </View>
            <View className={styles.action}>
              <Text className={styles.actionIcon}>💬</Text>
              <Text className={styles.actionText}>{getPostCommentCount(post)}</Text>
            </View>
          </View>
        </View>

        <View className={styles.commentsSection}>
          <Text className={styles.commentsTitle}>评论 ({comments.length})</Text>
          {comments.length > 0 ? (
            comments.map((comment) => (
              <View key={comment.id} className={styles.commentItem}>
                <View className={styles.commentHeader}>
                  {comment.isAnonymous ? (
                    <View className={styles.commentAnonymousAvatar}>
                      <Text className={styles.commentAnonymousText}>匿</Text>
                    </View>
                  ) : (
                    <SafeImage className={styles.commentAvatar} src={comment.authorAvatar} fallbackSrc={avatarFallback} mode="aspectFill" />
                  )}
                  <View className={styles.commentAuthorInfo}>
                    <Text className={styles.commentNickname}>{comment.authorNickname}</Text>
                    <Text className={styles.commentTime}>{formatDateTime(comment.createdAt)}</Text>
                  </View>
                </View>
                <Text className={styles.commentContent}>{comment.content}</Text>
              </View>
            ))
          ) : (
            <View className={styles.emptyComments}>
              <Text className={styles.emptyText}>暂无评论，来说点什么吧</Text>
            </View>
          )}
        </View>

        <View className={styles.bottomSpacing} />
      </ScrollView>

      <View className={styles.commentBar}>
        <Input className={styles.commentInput} placeholder="写下你的评论..." value={commentText} onInput={(event) => setCommentText(event.detail.value)} />
        <Button type="primary" size="small" disabled={!commentText.trim() || isSubmitting} onClick={handleSubmitComment}>
          发送
        </Button>
      </View>
    </View>
  );
};

export default PostDetailPage;
