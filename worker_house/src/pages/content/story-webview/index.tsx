import React, { useEffect } from 'react';
import { View, WebView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';

const StoryWebViewPage: React.FC = () => {
  const router = useRouter();
  const url = router.params.url ? decodeURIComponent(router.params.url) : '';
  const title = router.params.title ? decodeURIComponent(router.params.title) : '公众号文章';

  useEffect(() => {
    if (title) {
      Taro.setNavigationBarTitle({ title });
    }
  }, [title]);

  const handleError = (e: any) => {
    console.warn('WebView 加载失败，可能是业务域名未配置 mp.weixin.qq.com', e);
    if (url) {
      Taro.setClipboardData({
        data: url,
        success: () => {
          Taro.showModal({
            title: '提示',
            content: '链接已复制，请在微信中发送给文件传输助手后点击打开',
            showCancel: false,
            success: () => {
              Taro.navigateBack();
            }
          });
        }
      });
    } else {
      Taro.navigateBack();
    }
  };

  if (!url) {
    return <View>无效的链接</View>;
  }

  return (
    <WebView src={url} onError={handleError} />
  );
};

export default StoryWebViewPage;
