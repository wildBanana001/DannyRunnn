import React from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import type { Post } from '@/types/post';
import { getRelativeTime, formatNumber } from '@/utils/helpers';
import styles from './index.module.scss';

interface PostCardProps {
  post: Post;
  className?: string;
  onClick?: (post: Post) => void;
  onLike?: (post: Post) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, className, onClick, onLike }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(post);
    } else {
      Taro.navigateTo({
        url: `/pages/post-detail/index?id=${post.id}`
      });
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLike) {
      onLike(post);
    }
  };

  return (
    <View
      className={classnames(styles.card, className)}
      onClick={handleClick}
    >
      <View className={styles.header}>
        {post.isAnonymous ? (
          <View className={styles.anonymousAvatar}>
            <Text className={styles.anonymousText}>匿</Text>
          </View>
        ) : (
          <Image
            className={styles.avatar}
            src={post.authorAvatar || 'https://picsum.photos/id/64/200/200'}
            mode="aspectFill"
          />
        )}
        <View className={styles.authorInfo}>
          <Text className={styles.nickname}>{post.authorNickname}</Text>
          <Text className={styles.time}>{getRelativeTime(post.createdAt)}</Text>
        </View>
      </View>

      <Text className={styles.content}>{post.content}</Text>

      {post.images.length > 0 && (
        <View className={styles.images}>
          {post.images.slice(0, 3).map((image) => (
            <Image
              key={image}
              className={styles.image}
              src={image}
              mode="aspectFill"
            />
          ))}
          {post.images.length > 3 && (
            <View className={styles.moreImages}>
              <Text className={styles.moreText}>+{post.images.length - 3}</Text>
            </View>
          )}
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
          <Text className={classnames(styles.actionIcon, post.isLiked && styles.liked)}>
            {post.isLiked ? '❤️' : '🤍'}
          </Text>
          <Text className={classnames(styles.actionText, post.isLiked && styles.likedText)}>
            {formatNumber(post.likes)}
          </Text>
        </View>
        <View className={styles.action}>
          <Text className={styles.actionIcon}>💬</Text>
          <Text className={styles.actionText}>{formatNumber(post.comments)}</Text>
        </View>
      </View>
    </View>
  );
};

export default PostCard;
