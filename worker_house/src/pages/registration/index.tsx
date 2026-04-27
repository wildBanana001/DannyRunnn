import React, { useEffect } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import styles from './index.module.scss';

const RegistrationPage: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    const activityId = router.params.activityId || router.params.id;
    const query = activityId ? `?activityId=${activityId}` : '';
    Taro.redirectTo({ url: `/pages/register/index${query}` });
  }, [router.params]);

  return (
    <View className={styles.container}>
      <Text className={styles.title}>正在跳转到新的报名页…</Text>
    </View>
  );
};

export default RegistrationPage;
