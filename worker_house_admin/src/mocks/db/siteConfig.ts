import type { SiteConfig } from '@/types/site';

const defaultSiteConfig: SiteConfig = {
  ownerName: '香蕉',
  ownerAvatar: 'https://picsum.photos/id/1005/200/200',
  ownerBio: 'Worker House 主理人，热爱分享与社区，希望和你一起慢下来生活。',
  spaceImage: 'https://picsum.photos/800/600',
  spaceDescription: '一个位于珠海的社区空间，举办各类线下活动与工作坊。',
  videoFinderUserName:
    'export/UzFfAgtgekIEAQAAAAAA7rs5OQ_zcQAAAAstQy6ubaLX4KHWvLEZgBPE1qMsECFcBvGKzNPgMJpL10i6zxmLfZDm8KdEhzGE',
  videoFeedId:
    'export/UzFfAgtgekIEAQAAAAAA7rs5OQ_zcQAAAAstQy6ubaLX4KHWvLEZgBPE1qMsECFcBvGKzNPgMJpL10i6zxmLfZDm8KdEhzGE',
  videoCover: 'https://picsum.photos/1280/800',
  videoTitle: 'Worker House 空间介绍',
};

let siteConfig: SiteConfig = defaultSiteConfig;

export function getSiteConfigRecord() {
  return siteConfig;
}

export function updateSiteConfigRecord(nextConfig: SiteConfig) {
  siteConfig = { ...nextConfig };
  return siteConfig;
}

export function resetSiteConfig() {
  siteConfig = defaultSiteConfig;
}
