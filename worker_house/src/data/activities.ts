import type { Activity, Host, Venue } from '@/types';
import { resolveActivityStatus, selectActivitiesByStatus, type ActivityDisplayStatus } from '@/utils/activityStatus';
import { dinnerTableCoverImage } from './activity-assets';
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
> &
  Partial<Pick<Activity, 'price' | 'originalPrice' | 'maxParticipants' | 'cardEligible'>>;

const buildActivity = (activity: ActivitySeed): Activity => {
  const endDate = activity.startDate;

  return {
    ...activity,
    _id: activity.id,
    cover: activity.coverImage,
    covers: [activity.coverImage, ...activity.gallery],
    endDate,
    price: activity.price ?? 0.01,
    originalPrice: activity.originalPrice ?? activity.price ?? 0.01,
    maxParticipants: activity.maxParticipants ?? 11,
    currentParticipants: 0,
    status: resolveActivityStatus({
      startDate: activity.startDate,
      endDate,
      endTime: activity.endTime,
    }),
    hostId: sharedHostId,
    hostName: sharedHostName,
    hostAvatar: sharedHostAvatar,
    hostDescription: sharedHostDescription,
    refundPolicy: sharedRefundPolicy,
    createdAt: '2026-08-05T02:00:00.000Z',
    updatedAt: '2026-08-09T12:23:53.000Z',
    enabled: true,
    cardEligible: activity.cardEligible ?? false,
  };
};

export const allActivities: Activity[] = [
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
    title: '社畜小饭桌｜云贵川美食荟萃',
    description: '每月一次的小饭桌，用云贵川家宴、桌游和自酿山楂酒认识新朋友。',
    fullDescription:
      '每月一次的“社畜小饭桌”，希望用一张餐桌和美食拉近彼此的距离，像去朋友家聚会一样自然、放松、温暖。本期由主厨小九（新疆料理鼠王 / 厨王争霸赛冠军支持者）准备云贵川家宴，当天挑选新鲜食材并亲自下厨。菜单包含五常大米饭与手工粽、豆豉地摊火锅、泡椒藕带炒牛肉、藤椒手撕鸡、红三剁、老奶洋芋、蒜蓉炒通菜、傣味凉拌荷包蛋和花生莲藕鸡爪猪骨汤。饭前安排桌游破冰，流程为欢迎仪式、game time 和小饭桌；每人还可享一杯橙籽自酿半年熟山楂酒。',
    coverImage: dinnerTableCoverImage,
    gallery: [],
    startDate: '2026-08-09',
    startTime: '16:00',
    endTime: '20:00',
    price: 0.01,
    originalPrice: 178,
    category: '小饭桌',
    tags: ['云贵川美食', '家宴', '桌游破冰'],
    requirements: ['活动采用预约制，请报名成功后按时到场', '如有食物过敏或忌口，请提前联系主理人', '山楂酒含酒精，未成年人及不饮酒者可选择无酒精饮料'],
    includes: ['预约制家宴门票', '一杯自酿山楂酒', '饮料与小食自助', '桌游带玩', '活动精彩瞬间记录'],
    sort: 2,
  }),
  buildActivity({
    id: 'act-20260822-clay',
    title: '周末黏土手作体验',
    description: '制作相框、冰箱贴或小摆件，在轻松的周末完成一件自己的作品。',
    fullDescription:
      '活动先进行简短的作品示范和材料说明，再由参与者选择相框、冰箱贴或小摆件方向进行制作。老师会提供配色、造型和粘合指导，现场备有基础工具与材料，完成的作品可当日带走。',
    coverImage: images.img12,
    gallery: [images.img14, images.img15],
    startDate: '2026-08-22',
    startTime: '14:30',
    endTime: '18:00',
    price: 148,
    originalPrice: 148,
    category: '手作体验',
    tags: ['黏土 DIY', '周末活动', '零基础'],
    requirements: ['建议穿便于活动的衣服', '活动材料按一人一份准备', '如需制作指定造型可提前留言'],
    includes: ['活动名额', '黏土与基础配件', '老师现场指导', '饮品与小食', '作品打包'],
    sort: 4,
  }),
];

export const getLocalActivitiesByStatus = (
  status: ActivityDisplayStatus,
  now = Date.now(),
): Activity[] => selectActivitiesByStatus(allActivities, status, now);

// 保留旧导出供既有页面使用；实际列表每次读取时仍通过 getLocalActivitiesByStatus 重新分类。
export const ongoingActivities: Activity[] = getLocalActivitiesByStatus('ongoing');
export const featuredActivity: Activity = ongoingActivities[0] ?? allActivities[0];
export const upcomingActivities: Activity[] = ongoingActivities;

export const hostInfo: Host = {
  id: sharedHostId,
  name: sharedHostName,
  avatar: sharedHostAvatar,
  description: '把客厅变成线下主题活动空间的主理人。',
  background:
    '橙子从互联网行业离职后改造了这间 80m² 的社畜快乐屋，希望用主题交流、手作与轻松游戏，让工作之外的真实相遇有一个稳定空间。',
  activitiesCount: 3,
  followersCount: 0,
};

export const venueInfo: Venue = {
  id: 'venue-shenzhen-worker-house',
  name: '社畜快乐屋·深圳社交化客厅',
  description: '位于深圳南山大新站 D 口附近的线下活动空间，配有沙发客厅、投影设备与手作长桌。',
  images: [images.img29, images.img30, images.img17, images.img34],
  facilities: ['沙发客厅', '投影设备', '手作长桌', '活动材料区', '饮品与小食区'],
};
