import React from 'react';
import { Text, View } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';

interface HomeStickyActionsProps {
  hidden: boolean;
  onBook: () => void;
  onJoin: () => void;
}

const HomeStickyActions: React.FC<HomeStickyActionsProps> = ({ hidden, onBook, onJoin }) => (
  <View className={classnames(styles.container, hidden && styles.containerHidden)}>
    <View className={styles.button} onClick={onBook}>
      <Text className={styles.buttonText}>预约活动</Text>
    </View>
    <View className={styles.button} onClick={onJoin}>
      <Text className={styles.buttonText}>加入社群</Text>
    </View>
  </View>
);

export default HomeStickyActions;
