import Taro from '@tarojs/taro';

export function openOfficialAccountPage() {
  return Taro.navigateTo({
    url: '/pages/content/story-webview/index?mode=official-home'
  });
}
