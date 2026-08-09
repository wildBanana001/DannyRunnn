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
  buildActivity({
    id: 'act-20260816-crystal',
    title: '水晶权杖手作体验',
    description: '在材料老师指导下完成一支个人水晶权杖，零基础也可参加。',
    fullDescription:
      '本场为小班制手作预约活动。老师将介绍材料与工具的安全使用方法，带领参与者完成选材、结构固定、装饰组合与成品包装。活动不要求手作经验，每位参与者可在现场完成并带走一件作品。',
    coverImage: images.img10,
    gallery: [images.img11],
    startDate: '2026-08-16',
    startTime: '14:30',
    endTime: '18:00',
    category: '手作体验',
    tags: ['水晶手作', '零基础', '小班活动'],
    requirements: ['建议提前 10 分钟签到', '未成年人需由监护人陪同参加', '对金属或胶水敏感请提前告知'],
    includes: ['活动名额', '水晶权杖材料包', '工具使用与老师指导', '饮品与小食', '成品包装'],
    sort: 3,
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
    category: '手作体验',
    tags: ['黏土 DIY', '周末活动', '零基础'],
    requirements: ['建议穿便于活动的衣服', '活动材料按一人一份准备', '如需制作指定造型可提前留言'],
    includes: ['活动名额', '黏土与基础配件', '老师现场指导', '饮品与小食', '作品打包'],
    sort: 4,
  }),
  buildActivity({
    id: 'act-20260823-letters',
    title: '手写信与故事分享会',
    description: '用一封不必寄出的信整理近况，也听见不同人生阶段的真实故事。',
    fullDescription:
      '这是一场围绕书写与倾听展开的线下主题活动。主理人会提供写作提示卡和信纸，参与者可选择写给过去的自己、未来的自己或某位重要的人。分享环节遵循自愿原则，不要求公开信件内容。',
    coverImage: images.img18,
    gallery: [images.img17, images.img19],
    startDate: '2026-08-23',
    startTime: '19:30',
    endTime: '22:30',
    category: '主题交流',
    tags: ['手写信', '故事分享', '自愿表达'],
    requirements: ['建议准时到场参加活动说明', '分享完全自愿，可只参与书写', '请尊重其他参与者的隐私'],
    includes: ['活动名额', '信纸信封与提示卡', '主题引导', '饮品与小食'],
    sort: 5,
  }),
  buildActivity({
    id: 'act-20260828-reconcile',
    title: 'Deeptalk｜与自己和解',
    description: '通过主题提问和书写练习，聊聊内耗、自我期待与生活节奏。',
    fullDescription:
      '活动从自我期待、工作压力与关系边界等常见议题切入，通过小组约定、引导提问、个人书写和自愿分享逐步展开。这里不提供心理治疗或诊断，只提供一次平等、尊重且可自由退出表达的主题交流。',
    coverImage: images.img20,
    gallery: [images.img21],
    startDate: '2026-08-28',
    startTime: '19:30',
    endTime: '22:30',
    category: 'deeptalk',
    tags: ['自我和解', '主题交流', '书写练习'],
    requirements: ['建议准时参加活动约定说明', '允许沉默或跳过不想回答的问题', '活动不是心理咨询或医疗服务'],
    includes: ['活动名额', '主题引导与书写材料', '饮品与小食', '活动纪念卡'],
    sort: 6,
  }),
  buildActivity({
    id: 'act-20260830-boardgame',
    title: '周末桌游体验',
    description: '由主理人带规则和分桌，适合想轻松认识新朋友的桌游新手。',
    fullDescription:
      '活动将根据到场人数安排两到三款规则清晰、互动友好的桌游。主理人负责讲解规则、组织分桌与轮换，不需要自带游戏，也不要求有桌游经验。整场以轻松参与为主，不设置现金输赢。',
    coverImage: images.img22,
    gallery: [images.img23],
    startDate: '2026-08-30',
    startTime: '14:30',
    endTime: '18:00',
    category: '桌游体验',
    tags: ['桌游', '轻社交', '新手友好'],
    requirements: ['建议提前 10 分钟签到', '请遵守现场规则并尊重其他玩家', '活动不包含任何现金或有价筹码玩法'],
    includes: ['活动名额', '桌游与规则讲解', '分桌组织', '饮品与小食'],
    sort: 7,
  }),
  buildActivity({
    id: 'act-20260905-collage',
    title: '拼贴手账工作坊',
    description: '用旧杂志、色纸与文字素材完成一页属于自己的主题拼贴。',
    fullDescription:
      '老师会从构图、配色和素材选择开始示范，参与者可围绕近期生活、理想周末或下一阶段计划完成一页主题拼贴。现场提供杂志、纸张、贴纸和基础工具，作品完成后可装入透明保护袋带走。',
    coverImage: images.img14,
    gallery: [images.img15, images.img12],
    startDate: '2026-09-05',
    startTime: '14:30',
    endTime: '18:00',
    category: '手作体验',
    tags: ['拼贴', '手账', '创意工作坊'],
    requirements: ['可自带想使用的照片或纸质素材', '现场使用剪刀，请注意工具安全', '活动材料按一人一份准备'],
    includes: ['活动名额', '拼贴材料与基础工具', '老师示范与指导', '饮品与小食', '作品保护袋'],
    sort: 8,
  }),
  buildActivity({
    id: 'act-20260912-newcomer',
    title: '城市新人主题交流夜',
    description: '面向刚来到深圳或想拓展生活半径的人，进行一场有主题、有边界的交流。',
    fullDescription:
      '活动围绕“来到一座新城市以后”展开，通过双人破冰、小组问题卡和自由交流，聊居住体验、兴趣去处、工作之外的生活与建立支持网络的方法。主理人会明确交流边界，不强制交换私人联系方式。',
    coverImage: images.img06,
    gallery: [images.img08, images.img23],
    startDate: '2026-09-12',
    startTime: '19:30',
    endTime: '22:30',
    category: '主题交流',
    tags: ['城市新人', '主题交流', '轻社交'],
    requirements: ['建议准时参加开场说明', '不强制交换联系方式', '请尊重他人的表达边界与隐私'],
    includes: ['活动名额', '主题问题卡与现场引导', '饮品与小食', '深圳生活清单'],
    sort: 9,
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
  activitiesCount: 9,
  followersCount: 0,
};

export const venueInfo: Venue = {
  id: 'venue-shenzhen-worker-house',
  name: '社畜快乐屋·深圳社交化客厅',
  description: '位于深圳南山大新站 D 口附近的线下活动空间，配有沙发客厅、投影设备与手作长桌。',
  images: [images.img29, images.img30, images.img17, images.img34],
  facilities: ['沙发客厅', '投影设备', '手作长桌', '活动材料区', '饮品与小食区'],
};
