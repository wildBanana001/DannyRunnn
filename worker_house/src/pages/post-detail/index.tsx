import React, { useEffect, useState } from 'react';
import { Image, Input, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import { commentWallPost, fetchPostDetail } from '@/cloud/services';
import type { Comment, Post } from '@/types/post';
import { formatDateTime, getPostCommentCount, getRelativeTime } from '@/utils/helpers';
import styles from './index.module.scss';

const PostDetailPage: React.FC = () => {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const { id } = router.params;
    if (!id) {
      return;
    }

    fetchPostDetail(id)
      .then((result) => {
        setPost(result.post);
        setComments(result.comments);
      })
      .catch(() => {
        Taro.showToast({ title: '帖子加载失败', icon: 'none' });
      });
  }, [router.params]);

  const handleLike = () => {
    Taro.showToast({ title: '已收藏', icon: 'none' });
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !post) {
      return;
    }

    setIsSubmitting(true);
    const newComment = await commentWallPost(post.id, commentText.trim());
    setComments((current) => [newComment, ...current]);
    setPost({
      ...post,
      comments: post.comments + 1,
      commentsCount: (post.commentsCount ?? post.comments) + 1
    });
    setCommentText('');
    setIsSubmitting(false);
    Taro.showToast({ title: '评论成功', icon: 'success' });
  };

  if (!post) {
    return (
      <View className={styles.container}>
        <Text className={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View className={styles.container}>
      <ScrollView className={styles.scrollView} scrollY enableFlex>
        <View className={styles.postCard}>
          <View className={styles.header}>
            {post.isAnonymous ? (
              <View className={styles.anonymousAvatar}>
                <Text className={styles.anonymousText}>匿</Text>
              </View>
            ) : (
              <Image className={styles.avatar} src={post.authorAvatar || 'https://picsum.photos/id/64/200/200'} mode="aspectFill" />
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
            {post.images.map((image) => (
              <Image
                key={image}
                className={styles.image}
                src={image}
                mode="aspectFill"
                onClick={() => {
                  Taro.previewImage({
                    current: image,
                    urls: post.images,
                  });
                }}
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
                    <Image className={styles.commentAvatar} src={comment.authorAvatar || 'https://picsum.photos/id/64/200/200'} mode="aspectFill" />
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
