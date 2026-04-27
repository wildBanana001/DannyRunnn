import Taro from '@tarojs/taro';

declare const wx: any;

interface OpenVideoChannelOptions {
  finderUserName: string;
  feedId?: string;
  videoLink?: string;
}

const buildChannelLink = (finderUserName: string) => `https://channels.weixin.qq.com/${finderUserName}`;

const invokeChannelApi = (apiName: string, payload: Record<string, unknown>) => {
  return new Promise<boolean>((resolve) => {
    try {
      const wechat = wx as Record<string, unknown>;
      const method = wechat[apiName] as ((options: Record<string, unknown>) => void) | undefined;
      if (typeof method !== 'function') {
        resolve(false);
        return;
      }
      method({
        ...payload,
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    } catch (error) {
      console.warn('[video] 打开视频号失败', error);
      resolve(false);
    }
  });
};

export async function openVideoChannel({ finderUserName, feedId, videoLink }: OpenVideoChannelOptions): Promise<boolean> {
  if (!finderUserName && !feedId) {
    Taro.showToast({ title: '暂未配置视频号信息', icon: 'none' });
    return false;
  }

  if (!finderUserName && feedId) {
    try {
      await Taro.setClipboardData({ data: feedId });
      Taro.showToast({ title: '已复制，请去视频号搜索', icon: 'none', duration: 2500 });
      return true;
    } catch (error) {
      console.warn('[video] 复制 feedId 失败', error);
      return false;
    }
  }

  const attempts = [
    ...(feedId ? [{ apiName: 'openChannelsEvent', payload: { finderUserName, feedId } }] : []),
    { apiName: 'openChannelsUserProfile', payload: { finderUserName } },
    { apiName: 'openChannelsLive', payload: { finderUserName } },
    { apiName: 'openChannelsActivity', payload: { finderUserName } }
  ];

  for (const item of attempts) {
    if (await invokeChannelApi(item.apiName, item.payload)) {
      return true;
    }
  }

  const finalLink = videoLink || buildChannelLink(finderUserName);
  try {
    await Taro.setClipboardData({ data: finalLink });
    Taro.showToast({ title: '已复制视频号信息', icon: 'none' });
  } catch (error) {
    console.warn('[video] 复制视频号链接失败', error);
    Taro.showModal({
      title: '打开失败',
      content: `请手动搜索视频号：${finderUserName}`,
      showCancel: false
    });
  }

  return false;
}
