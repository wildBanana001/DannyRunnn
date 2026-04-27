import type { HomeVideo, SiteConfig } from '@/types/site';
import { wechatArticleImageUrls } from './wechat-images';

const communityQrPlaceholder = require('@/assets/home/community-qr.jpg');

export interface HomeManifestoItem {
  icon: string;
  title: string;
  description: string;
}

export interface HomeLandingConfig extends SiteConfig {
  heroImage: string;
  heroSlogan: string;
  heroSubtitle: string;
  heroTitle: string;
  originTitle: string;
  originParagraphs: string[];
  spaceGallery: string[];
  manifestoItems: HomeManifestoItem[];
  noList: string[];
  communityQr?: string;
}

export const defaultHomeVideos: HomeVideo[] = [
  {
    id: 'v1',
    cover: wechatArticleImageUrls.img17,
    title: '空间最新动态',
    finderUserName: '',
    feedId: 'export/UzFfAgtgekIEAQAAAAAA8Aw2VLlnPQAAAAstQy6ubaLX4KHWvLEZgBPEw6N8JzgmNoiJzNPgMJq0KXeLirIfr8NIBy0CZoH6',
    videoLink: 'https://channels.weixin.qq.com'
  },
  {
    id: 'v2',
    cover: wechatArticleImageUrls.img07,
    title: '邀请陌生人来家里玩的勇气瞬间',
    finderUserName: 'sph_worker_house_demo',
    feedId: '',
    videoLink: 'https://channels.weixin.qq.com'
  },
  {
    id: 'v3',
    cover: wechatArticleImageUrls.img18,
    title: '520《情书》客厅放映专场',
    finderUserName: 'sph_worker_house_demo',
    feedId: '',
    videoLink: 'https://channels.weixin.qq.com'
  }
];

const siteConfigData: HomeLandingConfig = {
  videoCover: defaultHomeVideos[0].cover,
  videoLink: 'https://channels.weixin.qq.com',
  finderUserName: 'sph_worker_house_demo',
  videos: defaultHomeVideos,
  spaceImage: wechatArticleImageUrls.img29,
  spaceDescription: '深圳南山大新站附近的一间社畜快乐屋，把每次相遇都变成松弛体验。',
  ownerAvatar: wechatArticleImageUrls.img24,
  ownerName: '橙子',
  ownerBio: '徒手爆改社畜快乐屋的体验派',
  title: '青工之家',
  heroImage: wechatArticleImageUrls.img35,
  heroSlogan: '社畜空间 · 真实聚点',
  heroSubtitle: '一个共居空间',
  heroTitle: '社畜没有派对',
  originTitle: '起源',
  originParagraphs: [
    '这里欢迎各种轻松又认真链接彼此的事情发生，让每个进门的人都能先放下角色，再慢慢认识真正的自己和彼此。'
  ],
  spaceGallery: [
    wechatArticleImageUrls.img29,
    wechatArticleImageUrls.img30,
    wechatArticleImageUrls.img17,
    wechatArticleImageUrls.img34,
    wechatArticleImageUrls.img23
  ],
  manifestoItems: [
    { icon: '🎉', title: 'fun 先发生', description: '这里欢迎主题派对、电影夜、桌游局和一点点合理发疯，让快乐先有具体的样子。' },
    { icon: '🪄', title: '活动一起共创', description: '设计师、疗愈师、调酒师、剪辑人都可以来发起提案，把自己的技能变成一次真实链接。' },
    { icon: '🛋️', title: '女性友好借宿', description: '留出温馨卧室和沙发床给有需要的女生，让短住也能拥有安全感和回家感。' },
    { icon: '🫶', title: '去标签化社交', description: '不靠职业、年龄、关系定义彼此，先做真实的人，再慢慢长出舒服的连接。' }
  ],
  noList: ['没有 KPI', '没有汇报', '没有加班', '没有人设', '没有尬聊', '没有推销', '没有时差', '没有催促', '没有标准答案'],
  communityQr: communityQrPlaceholder
};

export const siteConfig: SiteConfig = siteConfigData;
export const homeLandingConfig = siteConfigData;
