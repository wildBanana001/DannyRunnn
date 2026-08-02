import React, { useEffect } from 'react';
import { useDidHide, useDidShow } from '@tarojs/taro';
import { initCloud } from '@/cloud';
import { getApiMode, getPaymentApiMode } from '@/services/request';
import { useUserStore } from '@/store/userStore';
import './app.scss';

function App(props: { children?: React.ReactNode }) {
  const bootstrapFromCache = useUserStore((state) => state.bootstrapFromCache);

  useEffect(() => {
    if (getApiMode() === 'cloudrun' || getPaymentApiMode() === 'cloudrun') {
      initCloud();
    }
    bootstrapFromCache();
  }, [bootstrapFromCache]);

  useDidShow(() => {});
  useDidHide(() => {});

  return props.children;
}

export default App;
