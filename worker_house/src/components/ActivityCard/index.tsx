import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import AdaptiveCover from '@/components/AdaptiveCover';
import type { Activity } from '@/types/activity';
import { formatDate, formatPrice } from '@/utils/helpers';
import styles from './index.module.scss';

interface ActivityCardProps {
  activity: Activity;
  className?: string;
  onClick?: (activity: Activity) => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, className, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(activity);
    } else {
      Taro.navigateTo({
        url: `/pages/content/activity-detail/index?id=${activity.id}`
      });
    }
  };

  return (
    <View className={classnames(styles.card, className)} onClick={handleClick}>
      <AdaptiveCover className={styles.coverWrap} imageClassName={styles.coverImage} src={activity.coverImage} />
      <View className={styles.content}>
        <Text className={classnames(styles.title, 'font-display')}>{activity.title}</Text>
        <Text className={styles.description}>{activity.description}</Text>
        <View className={styles.meta}>
          <Text className={styles.date}>{formatDate(activity.startDate)}</Text>
        </View>
        <View className={styles.footer}>
          <View className={styles.priceSection}>
            <Text className={styles.price}>{formatPrice(activity.price)}</Text>
            {activity.originalPrice ? (
              <Text className={styles.originalPrice}>
                {formatPrice(activity.originalPrice)}
              </Text>
            ) : null}
          </View>
          <View className={styles.participants}>
            <Text className={styles.participantText}>
              已报名 {activity.currentParticipants}/{activity.maxParticipants}人
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ActivityCard;
