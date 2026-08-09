import React from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import styles from './index.module.scss';

interface CommunityWallUnavailableProps {
  loading: boolean;
}

const CommunityWallUnavailable: React.FC<CommunityWallUnavailableProps> = ({ loading }) => (
  <View className={styles.container}>
    {loading ? (
      <Text className={styles.loadingText}>正在读取留言墙设置…</Text>
    ) : (
      <EmptyState title="留言墙暂未开放" description="开放时间由服务端统一控制，之后再来看看吧。">
        <Button type="outline" block onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
          返回首页
        </Button>
      </EmptyState>
    )}
  </View>
);

export default CommunityWallUnavailable;
