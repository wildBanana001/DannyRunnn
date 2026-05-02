import React, { useEffect, useState } from 'react';
import { Image, Input, ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@/components/Button';
import BottomSheet from '@/components/BottomSheet';
import type { Comment, Post } from '@/types/post';
import { formatDateTime, getPostCommentCount } from '@/utils/helpers';
import styles from './post-modal.module.scss';

interface PostModalProps {
  visible: boolean;
  state: 'opening' | 'closing';
  post: Post | null;
  comments: Comment[];
  commentText: string;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onSubmitComment: () => void;
  onLike: (post: Post) => void;
  isSubmitting: boolean;
}

const PostModal: React.FC<PostModalProps> = ({
  visible,
  state,
  post,
  comments,
  commentText,
  onCommentChange,
  onClose,
  onSubmitComment,
  onLike,
  isSubmitting
}) => {
  const [cachedPost, setCachedPost] = useState<Post | null>(post);
  const [cachedComments, setCachedComments] = useState<Comment[]>(comments);
  const [scrollKey, setScrollKey] = useState(0);

  useEffect(() => {
    if (post) {
      setCachedPost(post);
    }
  }, [post]);

  useEffect(() => {
    setCachedComments(comments);
  }, [comments]);

  useEffect(() => {
    if (visible && post) {
      setScrollKey((current) => current + 1);
    }
  }, [post, visible]);

  const currentPost = post ?? cachedPost;
  if (!currentPost) {
    return null;
  }

  return (
    <BottomSheet
      visible={visible}
      state={state}
      onClose={onClose}
      className={`${styles.sheetPanel} ${styles[currentPost.color]}`}
      footer={(
        <View className={styles.inputBar}>
          <Input className={styles.input} placeholder="写下你的回应" value={commentText} onInput={(event) => onCommentChange(event.detail.value)} />
          <Button type="primary" size="small" disabled={!commentText.trim() || isSubmitting} onClick={onSubmitComment}>
            发布
          </Button>
        </View>
      )}
    >
      <ScrollView key={`${currentPost.id}-${scrollKey}`} className={styles.body} scrollY enableFlex>
        <View className={styles.bodyInner}>
          <Text className={styles.date}>{formatDateTime(currentPost.createdAt)}</Text>
          <Text className={styles.title}>{currentPost.title}</Text>
          <Text className={styles.content}>{currentPost.content}</Text>
          {currentPost.images.length > 0 && (
            <View className={styles.images}>
              {currentPost.images.map((image) => (
                <Image
                  key={image}
                  className={styles.image}
                  src={image}
                  mode="aspectFill"
                  onClick={() => {
                    Taro.previewImage({
                      current: image,
                      urls: currentPost.images,
                    });
                  }}
                />
              ))}
            </View>
          )}
          {currentPost.tags.length > 0 && (
            <View className={styles.tags}>
              {currentPost.tags.map((tag) => (
                <View key={tag} className={styles.tagChip}>
                  <Text className={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          <Text className={styles.author}>{currentPost.isAnonymous ? '匿名留言' : `来自 ${currentPost.authorNickname}`}</Text>
          <View className={styles.metaBar}>
            <View className={styles.metaButton} onClick={() => onLike(currentPost)}>
              <Text className={styles.metaText}>❤️ 收藏</Text>
            </View>
            <Text className={styles.metaText}>{getPostCommentCount(currentPost)} 条评论</Text>
          </View>
          <View className={styles.commentSection}>
            {cachedComments.length > 0 ? (
              cachedComments.map((comment) => (
                <View key={comment.id} className={styles.commentItem}>
                  <Text className={styles.commentAuthor}>{comment.authorNickname}</Text>
                  <Text className={styles.commentContent}>{comment.content}</Text>
                  <Text className={styles.commentTime}>{formatDateTime(comment.createdAt)}</Text>
                </View>
              ))
            ) : (
              <View className={styles.commentEmpty}>
                <Text className={styles.commentEmptyText}>还没有评论，留下第一句回应吧</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

export default PostModal;
