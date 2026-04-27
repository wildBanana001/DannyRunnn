import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import type { Activity } from '@/types';

type ActivitySeedInput = Omit<Activity, 'cardEligible' | 'cover' | 'coverImage' | 'covers'> & {
  cardEligible?: boolean;
  cover?: string;
  coverImage?: string;
  covers?: string[];
};

function uniqueStrings(values: string[]) {
  const nextValues: string[] = [];

  values.forEach((value) => {
    const normalized = value.trim();

    if (!normalized || nextValues.includes(normalized)) {
      return;
    }

    nextValues.push(normalized);
  });

  return nextValues;
}

function normalizeActivityRecord(input: ActivitySeedInput): Activity {
  const covers = uniqueStrings([
    ...(input.covers ?? []),
    input.cover ?? '',
    input.coverImage ?? '',
    ...input.gallery,
  ]);
  const primaryCover = covers[0] ?? '';

  return {
    ...input,
    cardEligible: input.cardEligible ?? true,
    cover: primaryCover,
    coverImage: primaryCover,
    covers,
  };
}

const featuredActivity = normalizeActivityRecord({
  id: 'act-001',
  title: '山野疗愈瑜伽 retreat',
  description: '逃离城市喧嚣，在莫干山竹海中找回内心的平静',
  fullDescription:
    '两天一夜的山野疗愈之旅，我们将在莫干山的竹海深处，开启一场身心灵的深度对话。第一天，伴着清晨的鸟鸣醒来，在专业瑜伽导师的带领下进行晨间冥想与流瑜伽练习。午后是自由探索时间，你可以漫步竹林小径，或在无边泳池边享受下午茶。傍晚时分，我们将围坐在篝火旁，分享彼此的故事。第二天，日出瑜伽后，享用有机农场直供的早午餐，随后是呼吸工作坊和音疗体验，让身心得到彻底的放松与净化。这是一次关于自我关怀的旅程，让我们一起慢下来，聆听内心的声音。',
  coverImage: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80',
  gallery: [
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',
    'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
  ],
  startDate: '2026-05-17',
  endDate: '2026-05-18',
  startTime: '10:00',
  endTime: '16:00',
  location: '莫干山',
  address: '浙江省湖州市德清县莫干山镇',
  price: 1680,
  originalPrice: 2180,
  maxParticipants: 16,
  currentParticipants: 12,
  status: 'upcoming',
  category: '身心疗愈',
  tags: ['瑜伽', '冥想', '疗愈', '自然', '周末 retreat'],
  cardEligible: true,
  hostId: 'host-001',
  hostName: '苏念',
  hostAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
  hostDescription: 'RYT-500 认证瑜伽导师，正念冥想引导师',
  venueName: '云栖竹径民宿',
  venueDescription:
    '隐匿于莫干山竹海中的设计师民宿，拥有无边泳池和全景瑜伽平台，是城市人逃离喧嚣的理想 sanctuary。',
  venueImages: [
    'https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=800&q=80',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
  ],
  requirements: ['适合所有瑜伽基础', '建议携带舒适运动服', '请自备瑜伽垫（或现场租借）'],
  includes: [
    '一晚精品民宿住宿',
    '3节专业瑜伽课程',
    '2顿有机早午餐',
    '1顿欢迎晚宴',
    '冥想音疗体验',
    '往返接驳车',
  ],
  refundPolicy: '活动开始前7天可申请全额退款，3-7天退50%，3天内不支持退款',
  createdAt: '2026-04-01T10:00:00Z',
  updatedAt: '2026-04-20T10:00:00Z',
});

const pastActivities: Activity[] = [
  normalizeActivityRecord({
    id: 'act-002',
    title: '手冲咖啡美学课',
    description: '从一颗咖啡豆到一杯醇香，探索精品咖啡的极致美学',
    fullDescription: '手冲咖啡入门到进阶课程，包含咖啡豆风味识别、研磨参数设置和器具实操。',
    coverImage: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
      'https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?w=800&q=80',
    ],
    startDate: '2026-04-12',
    endDate: '2026-04-12',
    startTime: '14:00',
    endTime: '17:00',
    location: '静安区',
    address: '上海市静安区巨鹿路758号',
    price: 368,
    maxParticipants: 12,
    currentParticipants: 12,
    status: 'ended',
    category: '生活美学',
    tags: ['咖啡', '手冲', '品鉴'],
    cardEligible: true,
    hostId: 'host-002',
    hostName: '林深',
    hostAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    hostDescription: 'SCA 认证咖啡师，2019 年中国手冲咖啡大赛亚军',
    venueName: 'NANA COFFEE',
    venueDescription: '藏在老洋房里的精品咖啡馆。',
    venueImages: ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80'],
    requirements: ['建议提前 10 分钟到场'],
    includes: ['精品豆试饮', '手冲器具体验', '课后风味卡'],
    refundPolicy: '课程开始前 24 小时可申请改期。',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-04-12T18:00:00Z',
  }),
  normalizeActivityRecord({
    id: 'act-003',
    title: '陶艺手作慢时光',
    description: '在转动的拉坯机上，感受泥土从指尖流淌的治愈力量',
    fullDescription: '陶艺体验工作坊，包含捏塑、拉坯和釉色选择，完成作品可统一烧制后寄送。',
    coverImage: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&q=80',
      'https://images.unsplash.com/photo-1459156212016-c812468e2115?w=800&q=80',
    ],
    startDate: '2026-04-05',
    endDate: '2026-04-05',
    startTime: '10:00',
    endTime: '16:00',
    location: '徐汇区',
    address: '上海市徐汇区武康路392号',
    price: 428,
    maxParticipants: 10,
    currentParticipants: 10,
    status: 'ended',
    category: '手工艺术',
    tags: ['陶艺', '手作', '治愈'],
    cardEligible: true,
    hostId: 'host-003',
    hostName: '周泥',
    hostAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
    hostDescription: '景德镇陶瓷大学硕士，独立陶艺师',
    venueName: '泥生陶艺工作室',
    venueDescription: '武康路上的静谧陶艺空间。',
    venueImages: ['https://images.unsplash.com/photo-1459156212016-c812468e2115?w=800&q=80'],
    requirements: ['建议穿深色衣物'],
    includes: ['基础泥料', '上釉指导', '作品烧制一次'],
    refundPolicy: '已开课活动不支持退款。',
    createdAt: '2026-03-10T10:00:00Z',
    updatedAt: '2026-04-05T18:00:00Z',
  }),
  normalizeActivityRecord({
    id: 'act-004',
    title: '法式甜点烘焙课',
    description: '学习制作经典马卡龙，体验法式甜点的浪漫与精致',
    fullDescription: '法式甜点烘焙课程，涵盖杏仁粉调和、糖浆打发和装饰技巧。',
    coverImage: 'https://images.unsplash.com/photo-1558326567-98ae2405596b?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=800&q=80',
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
    ],
    startDate: '2026-03-29',
    endDate: '2026-03-29',
    startTime: '13:00',
    endTime: '18:00',
    location: '浦东新区',
    address: '上海市浦东新区世纪大道100号',
    price: 498,
    maxParticipants: 8,
    currentParticipants: 8,
    status: 'ended',
    category: '烘焙',
    tags: ['烘焙', '甜点', '法式'],
    cardEligible: false,
    hostId: 'host-004',
    hostName: 'Emma',
    hostAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80',
    hostDescription: '法国蓝带甜点师，曾在巴黎米其林餐厅工作',
    venueName: 'Patisserie Emma',
    venueDescription: '专业法式甜点教室。',
    venueImages: ['https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80'],
    requirements: ['长发请自行扎起'],
    includes: ['马卡龙一盒', '烘焙围裙借用', '食材包'],
    refundPolicy: '因食材预订，开课前 48 小时后不支持退款。',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-29T20:00:00Z',
  }),
  normalizeActivityRecord({
    id: 'act-005',
    title: '城市光影摄影 walk',
    description: '用镜头捕捉上海的城市肌理，发现平凡中的不平凡',
    fullDescription: '城市摄影漫步，含街头构图、夜景参数和即时点评。',
    coverImage: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1493863641943-9b68992a8d07?w=800&q=80',
      'https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?w=800&q=80',
    ],
    startDate: '2026-03-22',
    endDate: '2026-03-22',
    startTime: '16:00',
    endTime: '19:00',
    location: '外滩',
    address: '上海市黄浦区外滩',
    price: 188,
    maxParticipants: 15,
    currentParticipants: 15,
    status: 'ended',
    category: '摄影',
    tags: ['摄影', '城市漫步', '光影'],
    cardEligible: true,
    hostId: 'host-005',
    hostName: '陈光',
    hostAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
    hostDescription: '国家地理签约摄影师',
    venueName: '外滩沿线',
    venueDescription: '上海最经典的摄影路线。',
    venueImages: ['https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?w=800&q=80'],
    requirements: ['请自带可拍摄设备'],
    includes: ['老师现场指导', '精选机位地图'],
    refundPolicy: '活动开始前 24 小时可改期一次。',
    createdAt: '2026-02-20T10:00:00Z',
    updatedAt: '2026-03-22T20:00:00Z',
  }),
  normalizeActivityRecord({
    id: 'act-006',
    title: '日式花道体验',
    description: '一花一世界，在插花中领悟东方美学的禅意',
    fullDescription: '日式花道体验课，学习池坊基础花型与器皿搭配。',
    coverImage: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&q=80',
      'https://images.unsplash.com/photo-1558551649-e44c8f992010?w=800&q=80',
    ],
    startDate: '2026-03-15',
    endDate: '2026-03-15',
    startTime: '14:00',
    endTime: '17:00',
    location: '长宁区',
    address: '上海市长宁区愚园路1088号',
    price: 328,
    maxParticipants: 12,
    currentParticipants: 11,
    status: 'ended',
    category: '花艺',
    tags: ['花道', '日式', '禅意'],
    cardEligible: true,
    hostId: 'host-006',
    hostName: '樱子',
    hostAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
    hostDescription: '池坊花道准教授，师从日本花道大师',
    venueName: '花见茶室',
    venueDescription: '日式禅意空间。',
    venueImages: ['https://images.unsplash.com/photo-1558551649-e44c8f992010?w=800&q=80'],
    requirements: ['现场提供花剪'],
    includes: ['花材一套', '花器借用', '作品拍摄'],
    refundPolicy: '活动开始后不支持退款。',
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: '2026-03-15T18:00:00Z',
  }),
];

const upcomingActivities: Activity[] = [
  featuredActivity,
  normalizeActivityRecord({
    id: 'act-007',
    title: '红酒品鉴与配餐艺术',
    description: '探索葡萄酒的奥秘，学习专业的品鉴与配餐技巧',
    fullDescription: '红酒品鉴之夜，包含基础闻香训练、风味轮讲解与奶酪冷切配餐。',
    coverImage: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800&q=80',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
    ],
    startDate: '2026-05-24',
    endDate: '2026-05-24',
    startTime: '19:00',
    endTime: '22:00',
    location: '静安区',
    address: '上海市静安区富民路183号',
    price: 458,
    originalPrice: 588,
    maxParticipants: 14,
    currentParticipants: 6,
    status: 'upcoming',
    category: '品酒',
    tags: ['红酒', '品鉴', '社交'],
    cardEligible: true,
    hostId: 'host-007',
    hostName: 'Alex',
    hostAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80',
    hostDescription: 'WSET Diploma 品酒师',
    venueName: 'Cellar Door',
    venueDescription: '专业红酒品鉴空间。',
    venueImages: ['https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80'],
    requirements: ['请勿自驾前往'],
    includes: ['5 款葡萄酒试饮', '奶酪冷切拼盘', '风味笔记卡'],
    refundPolicy: '活动开始前 72 小时可全额退款。',
    createdAt: '2026-04-15T10:00:00Z',
    updatedAt: '2026-04-15T10:00:00Z',
  }),
  normalizeActivityRecord({
    id: 'act-008',
    title: '油画写生下午茶',
    description: '在梧桐树下的老洋房，用画笔记录午后的慵懒时光',
    fullDescription: '油画零基础体验，老师将带大家完成一幅 8 开小画布作品。',
    coverImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&q=80',
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80',
    ],
    startDate: '2026-05-31',
    endDate: '2026-05-31',
    startTime: '14:00',
    endTime: '18:00',
    location: '徐汇区',
    address: '上海市徐汇区安福路322号',
    price: 298,
    maxParticipants: 12,
    currentParticipants: 4,
    status: 'upcoming',
    category: '绘画',
    tags: ['油画', '写生', '艺术'],
    cardEligible: true,
    hostId: 'host-008',
    hostName: '莫梵',
    hostAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&q=80',
    hostDescription: '中国美院油画系毕业，独立艺术家',
    venueName: '画室花园',
    venueDescription: '带花园的艺术工作室。',
    venueImages: ['https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80'],
    requirements: ['现场会提供围裙'],
    includes: ['颜料与画布', '下午茶套餐', '作品包装'],
    refundPolicy: '活动开始前 48 小时可申请改期。',
    createdAt: '2026-04-18T10:00:00Z',
    updatedAt: '2026-04-18T10:00:00Z',
  }),
];

const extraActivities: Activity[] = [
  normalizeActivityRecord({
    id: 'act-009',
    title: '海边晨跑与呼吸训练',
    description: '在海风中完成一场轻量唤醒训练，开启充满能量的一天',
    fullDescription:
      '面向城市白领的晨跑活动，包含轻量热身、节奏跑和呼吸恢复练习。课程结束后提供能量早餐和社群交流时间。',
    coverImage: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1486218119243-13883505764c?w=800&q=80',
      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
    ],
    startDate: '2026-06-06',
    endDate: '2026-06-06',
    startTime: '07:00',
    endTime: '09:30',
    location: '香洲区',
    address: '广东省珠海市香洲区情侣路海滨泳场',
    price: 99,
    originalPrice: 129,
    maxParticipants: 30,
    currentParticipants: 18,
    status: 'upcoming',
    category: '运动社交',
    tags: ['晨跑', '呼吸训练', '海边', '珠海'],
    cardEligible: false,
    hostId: 'host-009',
    hostName: '阿泽',
    hostAvatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=200&q=80',
    hostDescription: 'NASM 认证体能教练，专注办公室人群体态与心肺训练',
    venueName: '海滨泳场集合点',
    venueDescription: '临海步道宽阔，适合进行节奏跑和社群互动。',
    venueImages: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'],
    requirements: ['建议穿轻便跑鞋', '请自备饮用水'],
    includes: ['热身指导', '跑后拉伸', '能量早餐'],
    refundPolicy: '活动开始前24小时可全额退款，之后不支持退款。',
    createdAt: '2026-04-22T09:00:00Z',
    updatedAt: '2026-04-22T09:00:00Z',
  }),
  normalizeActivityRecord({
    id: 'act-010',
    title: 'AI 工作者松弛力沙龙',
    description: '面向技术与产品同学的轻社交沙龙，聊工作也聊生活秩序感',
    fullDescription:
      '围绕高压工作节奏中的专注管理、情绪恢复和社交支持，设置主题分享、自由交流和桌面手作三个环节，适合想结识同频伙伴的年轻人。',
    coverImage: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
    ],
    startDate: '2026-06-12',
    endDate: '2026-06-12',
    startTime: '19:30',
    endTime: '21:30',
    location: '高新区',
    address: '广东省珠海市高新区唐家湾人才会客厅',
    price: 168,
    maxParticipants: 24,
    currentParticipants: 9,
    status: 'ongoing',
    category: '主题沙龙',
    tags: ['AI', '沙龙', '职场恢复力', '社交'],
    cardEligible: true,
    hostId: 'host-010',
    hostName: 'Mia',
    hostAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
    hostDescription: '社群主理人，长期组织技术社区与女性成长议题活动',
    venueName: '人才会客厅',
    venueDescription: '适合小规模社群活动的轻会场，带咖啡与阅读角。',
    venueImages: ['https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80'],
    requirements: ['请准时签到', '建议携带名片或个人介绍'],
    includes: ['主题分享', '饮品小食', '桌面手作材料'],
    refundPolicy: '活动开始前48小时支持全额退款。',
    createdAt: '2026-04-24T12:00:00Z',
    updatedAt: '2026-04-25T12:00:00Z',
  }),
];

export const activitySeedData: Activity[] = [
  featuredActivity,
  ...pastActivities,
  ...upcomingActivities.filter((activity) => activity.id !== featuredActivity.id),
  ...extraActivities,
];

let activities = [...activitySeedData];

export function resetActivities() {
  activities = [...activitySeedData];
}

export function listActivities() {
  return [...activities];
}

export function findActivityById(id: string) {
  return activities.find((activity) => activity.id === id) ?? null;
}

export function createActivityRecord(payload: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>) {
  const timestamp = dayjs().toISOString();
  const nextActivity = normalizeActivityRecord({
    ...payload,
    id: nanoid(10),
    currentParticipants: payload.currentParticipants ?? 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  activities = [nextActivity, ...activities];
  return nextActivity;
}

export function updateActivityRecord(id: string, payload: Activity) {
  const currentActivity = findActivityById(id);

  if (!currentActivity) {
    return null;
  }

  const nextActivity = normalizeActivityRecord({
    ...currentActivity,
    ...payload,
    id,
    createdAt: currentActivity.createdAt,
    updatedAt: dayjs().toISOString(),
  });

  activities = activities.map((activity) => (activity.id === id ? nextActivity : activity));
  return nextActivity;
}

export function deleteActivityRecord(id: string) {
  const exists = activities.some((activity) => activity.id === id);
  activities = activities.filter((activity) => activity.id !== id);
  return exists;
}
