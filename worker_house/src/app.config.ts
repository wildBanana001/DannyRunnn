export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/activity/index',
    'pages/wall/index',
    'pages/mine/index',
    'pages/poster-detail/index',
    'pages/register/index',
    'pages/registration/index',
    'pages/post-detail/index',
    'pages/past-activities/index',
    'pages/my-profiles/index',
    'pages/my-cards/index',
    'pages/my-addresses/index',
    'pages/address-edit/index',
    'pages/settings/index'
  ],
  subPackages: [
    {
      root: 'pages/admin',
      pages: [
        'index/index',
        'activities/index',
        'activity-edit/index',
        'dashboard/index',
        'posts/index',
        'posters/index',
        'poster-edit/index',
        'site-config/index',
        'stories/index',
        'story-edit/index',
        'registrations/index',
        'registration-detail/index',
        'card-orders/index',
        'card-order-detail/index',
        'card-packages/index',
        'card-package-edit/index'
      ],
    },
    {
      root: 'pages/content',
      pages: [
        'wall-publish/index',
        'story-detail/index',
        'story-webview/index',
        'origin-detail/index',
        'activity-detail/index',
        'my-registrations/index',
        'my-posts/index',
        'registration-detail/index'
      ],
    },
  ],
  tabBar: {
    color: '#8B7355',
    selectedColor: '#E60000',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tabbar/tab-home-normal.png',
        selectedIconPath: 'assets/tabbar/tab-home-active.png'
      },
      {
        pagePath: 'pages/activity/index',
        text: '活动',
        iconPath: 'assets/tabbar/tab-activity-normal.png',
        selectedIconPath: 'assets/tabbar/tab-activity-active.png'
      },
      {
        pagePath: 'pages/wall/index',
        text: '留言墙',
        iconPath: 'assets/tabbar/tab-wall-normal.png',
        selectedIconPath: 'assets/tabbar/tab-wall-active.png'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tabbar/tab-mine-normal.png',
        selectedIconPath: 'assets/tabbar/tab-mine-active.png'
      }
    ]
  },
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#F7F6F2',
    navigationBarTitleText: 'worker_house',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F7F6F2'
  }
});
