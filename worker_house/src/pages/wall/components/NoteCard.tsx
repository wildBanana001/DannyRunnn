import React from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { Post } from '@/types/post';
import { getPostCommentCount, getPostExcerpt, getRelativeTime } from '@/utils/helpers';
import tapeImage from '@/assets/illustrations/tape.png';
import styles from './note-card.module.scss';

interface NoteCardProps {
  post: Post;
  tilt: number;
  onClick: (post: Post) => void;
  onLike: (post: Post) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ post, tilt, onClick, onLike }) => {
  const visibleTags = post.tags.slice(0, 2);
  const hiddenTagCount = Math.max(0, post.tags.length - visibleTags.length);

  return (
    <View className={`${styles.card} ${styles[post.color]}`} style={{ transform: `rotate(${tilt}deg)` }} onClick={() => onClick(post)}>
      <Image className={styles.tape} src={tapeImage} mode="widthFix" />
      <Text className={styles.time}>{getRelativeTime(post.createdAt)}</Text>
      <Text className={`${styles.title} font-display`}>{post.title}</Text>
      <Text className={styles.content}>{getPostExcerpt(post.content, 62)}</Text>
      {post.images[0] ? (
        <Image
          className={styles.previewImage}
          src={post.images[0]}
          mode="aspectFill"
          onClick={(event) => {
            event.stopPropagation();
            Taro.previewImage({
              current: post.images[0],
              urls: post.images,
            });
          }}
        />
      ) : null}
      {visibleTags.length > 0 && (
        <View className={styles.tags}>
          {visibleTags.map((tag) => (
            <View key={tag} className={styles.tagChip}>
              <Text className={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {hiddenTagCount > 0 && <Text className={styles.moreTag}>...</Text>}
        </View>
      )}
      <View className={styles.footer}>
        <View className={styles.action} onClick={(event) => { event.stopPropagation(); onLike(post); }}>
          <Text className={styles.actionText}>❤️ 收藏</Text>
        </View>
        <Text className={styles.actionText}>{getPostCommentCount(post)} 条评论</Text>
      </View>
    </View>
  );
};

export default NoteCard;
