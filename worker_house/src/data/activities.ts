import type { Activity, Host, Venue } from '@/types';
import { wechatArticleImageUrls as images } from './wechat-images';

const sharedHostId = 'host-orange';
const sharedHostName = '橙子';
const sharedHostAvatar = images.img24;
const sharedHostDescription = '互联网大厂裸辞后徒手爆改 80m² 社畜快乐屋的 ENFJ 理想主义体验派。';
const sharedRefundPolicy =
  '活动开始前 24 小时可申请全额退款；开始前 24 小时内可联系主理人改期一次；开始前 3 小时内及活动开始后不支持退款。若活动由主办方取消，将原路全额退款。';

type ActivitySeed = Pick<
  Activity,
  | 'id'
  | 'title'
  | 'description'
  | 'fullDescription'
  | 'coverImage'
  | 'gallery'
  | 'startDate'
  | 'startTime'
  | 'endTime'
  | 'category'
  | 'tags'
  | 'requirements'
  | 'includes'
  | 'sort'
>;

const buildActivity = (activity: ActivitySeed): Activity => ({
  ...activity,
  _id: activity.id,
  cover: activity.coverImage,
  covers: [activity.coverImage, ...activity.gallery],
  endDate: activity.startDate,
  price: 0.01,
  originalPrice: 0.01,
  maxParticipants: 11,
  currentParticipants: 0,
  status: 'ongoing',
  hostId: sharedHostId,
  hostName: sharedHostName,
  hostAvatar: sharedHostAvatar,
  hostDescription: sharedHostDescription,
  refundPolicy: sharedRefundPolicy,
  createdAt: '2026-08-05T02:00:00.000Z',
  updatedAt: '2026-08-09T12:23:53.000Z',
  enabled: true,
  cardEligible: false,
});

export const ongoingActivities: Activity[] = [
  buildActivity({
    id: 'act-001',
    title: 'Deeptalk｜人生里的 N 种选择',
    description: '聊那些和主流成功叙事不完全一致、却依然诚实的选择。',
    fullDescription:
      '围绕“人生里的 N 种选择”展开主题交流。主理人会分享从大厂上班、裸辞到经营线下空间的经历，也邀请大家聊聊工作、学习、关系与生活节奏中的真实困惑。活动由欢迎说明、主题提问、开放分享和互相回应组成。',
    coverImage: images.img06,
    gallery: [images.img07],
    startDate: '2026-08-08',
    startTime: '19:30',
    endTime: '23:00',
    category: 'deeptalk',
    tags: ['人生选择', '主题交流', '小组分享'],
    requirements: ['建议准时到场参加开场说明', '可跳过不想回答的问题', '如不希望出镜请提前告知主理人'],
    includes: ['活动名额', '主题引导与互动材料', '饮品与小食', '活动纪念卡'],
    sort: 1,
  }),
  buildActivity({
    id: 'act-002',
    title: 'Deeptalk｜幸福的奥义',
    description: '从记忆里的幸福瞬间出发，重新定义什么才算“过得不错”。',
    fullDescription:
      '本场围绕个人对幸福的真实感受展开，从近期的幸福瞬间延展到工作、关系、家庭与自我照顾。现场设有轻量破冰、幸福时刻卡片、自由分享和互相回应环节，表达和分享均遵循自愿原则。',
    coverImage: images.img08,
    gallery: [images.img09],
    startDate: '2026-08-14',
    startTime: '19:30',
    endTime: '23:00',
    category: 'deeptalk',
    tags: ['幸福感', '主题交流', '小组分享'],
    requirements: ['允许慢热，不需要强行表达', '可带一件让你想起幸福的物品', '如不希望出镜请提前告知主理人'],
    includes: ['活动名额', '主题引导与互动材料', '饮品与小食', '幸福时刻卡片'],
    sort: 2,
  }),
];

export const featuredActivity: Activity = ongoingActivities[0];
export const upcomingActivities: Activity[] = ongoingActivities;
export const allActivities: Activity[] = ongoingActivities;

export const hostInfo: Host = {
  id: sharedHostId,
  name: sharedHostName,
  avatar: sharedHostAvatar,
  description: '把客厅变成线下主题活动空间的主理人。',
  background:
    '橙子从互联网行业离职后改造了这间 80m² 的社畜快乐屋，希望用主题交流、手作与轻松游戏，让工作之外的真实相遇有一个稳定空间。',
  activitiesCount: 2,
  followersCount: 0,
};

export const venueInfo: Venue = {
  id: 'venue-shenzhen-worker-house',
  name: '社畜快乐屋·深圳社交化客厅',
  description: '位于深圳南山大新站 D 口附近的线下活动空间，配有沙发客厅、投影设备与手作长桌。',
  images: [images.img29, images.img30, images.img17, images.img34],
  facilities: ['沙发客厅', '投影设备', '手作长桌', '活动材料区', '饮品与小食区'],
};
