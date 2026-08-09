import type {
  ActivityRecord,
  AdminRecord,
  CommentRecord,
  PostRecord,
  PosterRecord,
  SiteConfigRecord,
} from './types.js';

const img = {
  img01:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-01.jpg',
  img04:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-04.jpg',
  img05:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-05.jpg',
  img06:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-06.jpg',
  img07:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-07.jpg',
  img08:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-08.jpg',
  img09:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-09.jpg',
  img10:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-10.jpg',
  img11:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-11.jpg',
  img12:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-12.jpg',
  img14:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-14.jpg',
  img15:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-15.jpg',
  img17:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-17.jpg',
  img18:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-18.jpg',
  img19:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-19.jpg',
  img20:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-20.jpg',
  img21:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-21.jpg',
  img22:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-22.jpg',
  img23:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-23.jpg',
  img24:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-24.jpg',
  img29:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-29.jpg',
  img30:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-30.jpg',
  img31:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-31.jpg',
  img32:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-32.jpg',
  img34:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-34.jpg',
  img35:
    'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la/worker-house/wechat-article/img-35.jpg',
} as const;

const dinnerTableAssets = {
  coverImage: 'activity-asset://dinner-table/cover.jpg',
  gallery: [
    'activity-asset://dinner-table/menu.jpg',
    'activity-asset://dinner-table/food-1.jpg',
    'activity-asset://dinner-table/food-2.jpg',
    'activity-asset://dinner-table/food-3.jpg',
    'activity-asset://dinner-table/food-4.jpg',
  ],
} as const;

const sharedLocation = '深圳南山大新站 D 口附近的社畜快乐屋';
const sharedAddress = '深圳市南山区大新地铁站 D 口附近（报名成功后发送详细门牌）';
const sharedHostId = 'host-orange';
const sharedHostName = '橙子';
const sharedHostAvatar = img.img24;
const sharedHostDescription = '互联网大厂裸辞后徒手爆改 80m² 社畜快乐屋的 ENFJ 理想主义体验派。';
const sharedVenueName = '社畜快乐屋·深圳社交化客厅';
const sharedVenueDescription =
  '一间配有沙发客厅、手作长桌和投影设备的线下活动空间，可开展主题交流、手作体验与桌游活动。';
const sharedVenueImages = [img.img29, img.img30, img.img17, img.img34];
const sharedRefundPolicy =
  '活动开始前 24 小时可申请全额退款；开始前 24 小时内可联系主理人改期一次；开始前 3 小时内及活动开始后不支持退款。若活动由主办方取消，将原路全额退款。';

const buildActivityRecord = (activity: ActivityRecord): ActivityRecord => ({
  ...activity,
  cover: activity.cover || activity.coverImage,
  covers:
    activity.covers && activity.covers.length > 0
      ? activity.covers
      : [activity.cover || activity.coverImage, ...activity.gallery],
  cardEligible: activity.cardEligible ?? false,
});

export const adminSeedData: AdminRecord[] = [
  {
    id: 'admin-001',
    username: 'admin',
    password: 'admin123',
    token: 'mock-admin-token',
    name: '管理员',
    role: 'admin',
  },
];

export const posterSeedData: PosterRecord[] = [
  {
    id: 'poster-001',
    title: 'House Party 客厅行动计划',
    coverImage: img.img01,
    detailImages: [img.img01],
    enabled: true,
    sort: 1,
    createdAt: '2026-04-26T09:00:00Z',
    updatedAt: '2026-04-26T09:00:00Z',
  },
  {
    id: 'poster-002',
    title: '4 月故事录：我们在客厅看见彼此',
    coverImage: img.img04,
    detailImages: [img.img04],
    enabled: true,
    sort: 2,
    createdAt: '2026-04-26T08:50:00Z',
    updatedAt: '2026-04-26T08:50:00Z',
  },
  {
    id: 'poster-003',
    title: '5 月活动总览 · deeptalk & houseparty',
    coverImage: img.img05,
    detailImages: [img.img05],
    enabled: true,
    sort: 3,
    createdAt: '2026-04-26T08:40:00Z',
    updatedAt: '2026-04-26T08:40:00Z',
  },
  {
    id: 'poster-004',
    title: '4 月排期回看',
    coverImage: img.img31,
    detailImages: [img.img31],
    enabled: true,
    sort: 4,
    createdAt: '2026-04-26T08:30:00Z',
    updatedAt: '2026-04-26T08:30:00Z',
  },
  {
    id: 'poster-005',
    title: '3 月排期回看',
    coverImage: img.img32,
    detailImages: [img.img32],
    enabled: true,
    sort: 5,
    createdAt: '2026-04-26T08:20:00Z',
    updatedAt: '2026-04-26T08:20:00Z',
  },
];

export const activitySeedData: ActivityRecord[] = [
  buildActivityRecord({
    id: 'act-001',
    title: 'Deeptalk｜人生里的 N 种选择',
    description: '聊那些和主流成功叙事不完全一致、却依然诚实的选择。',
    fullDescription:
      '围绕“人生里的 N 种选择”展开的大型聊天局。橙子会分享自己从大厂上班、裸辞到经营社畜快乐屋的经历，也会邀请大家聊聊上班还是考研、轻松还是高薪、喜欢与被喜欢等真实困惑。活动由欢迎仪式、主题提问、开放分享和夸夸 time 组成，让每个选择都被认真听见。',
    coverImage: img.img06,
    cover: img.img06,
    gallery: [img.img07],
    covers: [img.img06, img.img07],
    startDate: '2026-08-08',
    endDate: '2026-08-08',
    startTime: '19:30',
    endTime: '23:00',
    location: sharedLocation,
    address: sharedAddress,
    price: 0.01,
    originalPrice: 0.01,
    maxParticipants: 11,
    currentParticipants: 0,
    status: 'ongoing',
    category: 'deeptalk',
    tags: ['人生选择', '深度社交', '夸夸 time'],
    cardEligible: true,
    hostId: sharedHostId,
    hostName: sharedHostName,
    hostAvatar: sharedHostAvatar,
    hostDescription: sharedHostDescription,
    venueName: sharedVenueName,
    venueDescription: sharedVenueDescription,
    venueImages: sharedVenueImages,
    requirements: ['建议准时到场，方便完整参与破冰和欢迎仪式', '想匿名表达也可以，只需要给自己取一个当晚昵称', '如不想出镜或公开分享，可提前和主理人说一声'],
    includes: ['活动名额', '主题引导与互动材料', '饮品与小食', '夸夸环节仪式卡'],
    refundPolicy: sharedRefundPolicy,
    createdAt: '2026-08-05T02:00:00.000Z',
    updatedAt: '2026-08-09T12:23:53.000Z',
    enabled: true,
    sort: 1,
  }),
  buildActivityRecord({
    id: 'act-002',
    title: '社畜小饭桌｜云贵川美食荟萃',
    description: '每月一次的小饭桌，用云贵川家宴、桌游和自酿山楂酒认识新朋友。',
    fullDescription:
      '每月一次的“社畜小饭桌”，希望用一张餐桌和美食拉近彼此的距离，像去朋友家聚会一样自然、放松、温暖。本期由主厨小九（新疆料理鼠王 / 厨王争霸赛冠军支持者）准备云贵川家宴，当天挑选新鲜食材并亲自下厨。菜单包含五常大米饭与手工粽、豆豉地摊火锅、泡椒藕带炒牛肉、藤椒手撕鸡、红三剁、老奶洋芋、蒜蓉炒通菜、傣味凉拌荷包蛋和花生莲藕鸡爪猪骨汤。饭前安排桌游破冰，流程为欢迎仪式、game time 和小饭桌；每人还可享一杯橙籽自酿半年熟山楂酒。',
    coverImage: dinnerTableAssets.coverImage,
    cover: dinnerTableAssets.coverImage,
    gallery: [...dinnerTableAssets.gallery],
    covers: [dinnerTableAssets.coverImage, ...dinnerTableAssets.gallery],
    startDate: '2026-08-09',
    endDate: '2026-08-09',
    startTime: '16:00',
    endTime: '20:00',
    location: sharedLocation,
    address: sharedAddress,
    price: 0.01,
    originalPrice: 178,
    maxParticipants: 11,
    currentParticipants: 0,
    status: 'ongoing',
    category: '小饭桌',
    tags: ['云贵川美食', '家宴', '桌游破冰'],
    cardEligible: false,
    hostId: sharedHostId,
    hostName: sharedHostName,
    hostAvatar: sharedHostAvatar,
    hostDescription: sharedHostDescription,
    venueName: sharedVenueName,
    venueDescription: sharedVenueDescription,
    venueImages: sharedVenueImages,
    requirements: ['活动采用预约制，请报名成功后按时到场', '如有食物过敏或忌口，请提前联系主理人', '山楂酒含酒精，未成年人及不饮酒者可选择无酒精饮料'],
    includes: ['预约制家宴门票', '一杯自酿山楂酒', '饮料与小食自助', '桌游带玩', '活动精彩瞬间记录'],
    refundPolicy: sharedRefundPolicy,
    createdAt: '2026-08-05T02:00:00.000Z',
    updatedAt: '2026-08-10T02:00:00.000Z',
    enabled: true,
    sort: 2,
  }),
];

export const postSeedData: PostRecord[] = [
  {
    id: 'post-001',
    authorId: 'user-001',
    authorNickname: '匿名打工人',
    title: '第一次在陌生人面前把话说完',
    content:
      '上周在社畜快乐屋参加 deeptalk，第一次发现“原来讲完自己的故事不会被打断”这件事这么治愈。谢谢那天认真听我说话的人，也想把这份勇气留给下一个还在犹豫要不要来的朋友。',
    images: [],
    likes: 42,
    comments: 3,
    commentsCount: 3,
    isLiked: false,
    isAnonymous: true,
    tags: ['心事', 'deeptalk'],
    color: 'yellow',
    isPinned: false,
    pinned: false,
    createdAt: '2026-04-25T08:30:00Z',
    updatedAt: '2026-04-25T08:30:00Z',
  },
  {
    id: 'post-002',
    authorId: 'user-current',
    authorNickname: '橙子',
    authorAvatar: img.img24,
    title: '上一场的拍立得笑脸洗出来啦',
    content:
      '把上一场游戏日和客厅夜谈的拍立得整理了一遍，发现大家在镜头里都笑得好松。原来“邀请陌生人来我家玩”这件事，真的会慢慢变成“谢谢你来过我的客厅”。',
    images: [img.img23],
    likes: 88,
    comments: 2,
    commentsCount: 2,
    isLiked: true,
    isAnonymous: false,
    tags: ['回顾', '拍立得', '社畜快乐屋'],
    color: 'pink',
    isPinned: false,
    pinned: false,
    createdAt: '2026-04-24T20:15:00Z',
    updatedAt: '2026-04-24T20:15:00Z',
  },
  {
    id: 'post-003',
    authorId: 'user-003',
    authorNickname: '住在大新的路人',
    title: '在客厅被夸奖以后，回家路都轻了',
    content:
      '本来只是想下班后找个地方待一会儿，结果在夸夸环节被陌生人认真说“你很会照顾别人”。那一瞬间突然有点想哭，原来有人真的会看见这些很小的努力。',
    images: [],
    likes: 56,
    comments: 1,
    commentsCount: 1,
    isLiked: false,
    isAnonymous: false,
    tags: ['夸夸 time', '日常'],
    color: 'blue',
    isPinned: false,
    pinned: false,
    createdAt: '2026-04-24T14:20:00Z',
    updatedAt: '2026-04-24T14:20:00Z',
  },
  {
    id: 'post-004',
    authorId: 'user-004',
    authorNickname: '匿名加班人',
    title: '太累的时候还会赴约吗',
    content:
      '最近工作真的很满，常常临近活动就想取消。但每次想到社畜快乐屋里那种“可以什么都不表演”的氛围，又会舍不得。想问问大家，疲惫到不想说话的时候，你们还会来客厅坐坐吗？',
    images: [],
    likes: 71,
    comments: 2,
    commentsCount: 2,
    isLiked: false,
    isAnonymous: true,
    tags: ['求助', '心事'],
    color: 'green',
    isPinned: false,
    pinned: false,
    createdAt: '2026-04-23T18:00:00Z',
    updatedAt: '2026-04-23T18:00:00Z',
  },
  {
    id: 'post-005',
    authorId: 'user-005',
    authorNickname: '客厅巡逻员',
    title: '留言墙又满了一整层便签',
    content:
      '刚刚路过留言墙，发现又被新的一层便签贴满了：有人写“谢谢你们让我觉得自己没那么糟”，有人写“祝下次来的我已经更勇敢一点”。这面墙真的像在替很多人保存一点下班后的呼吸感。',
    images: [img.img34],
    likes: 103,
    comments: 1,
    commentsCount: 1,
    isLiked: true,
    isAnonymous: false,
    tags: ['留言墙', '树洞'],
    color: 'orange',
    isPinned: false,
    pinned: false,
    createdAt: '2026-04-22T16:45:00Z',
    updatedAt: '2026-04-22T16:45:00Z',
  },
  {
    id: 'post-006',
    authorId: 'user-006',
    authorNickname: '匿名用户',
    title: '今晚允许自己只做一件开心的小事',
    content:
      '如果你也在经历“什么都不想做”的阶段，希望今晚的你至少能给自己留一点点温柔：洗个热水澡、去楼下散步、或者只是躺着听一首很喜欢的歌。剩下的，我们明天再说。',
    images: [],
    likes: 154,
    comments: 2,
    commentsCount: 2,
    isLiked: false,
    isAnonymous: true,
    tags: ['树洞', '晚安'],
    color: 'purple',
    isPinned: false,
    pinned: false,
    createdAt: '2026-04-21T15:30:00Z',
    updatedAt: '2026-04-21T15:30:00Z',
  },
];

export const commentSeedData: CommentRecord[] = [
  {
    id: 'comment-001',
    postId: 'post-001',
    authorId: 'user-101',
    authorNickname: '抱抱你',
    content: '会，我最近也在这里第一次把心里话说完整，真的会轻一点。',
    likes: 5,
    isLiked: false,
    isAnonymous: false,
    createdAt: '2026-04-25T09:00:00Z',
    updatedAt: '2026-04-25T09:00:00Z',
  },
  {
    id: 'comment-002',
    postId: 'post-002',
    authorId: 'user-102',
    authorNickname: '拍立得收集癖',
    content: '这张三连真的太有客厅味道了，看完更想来游戏日。',
    likes: 3,
    isLiked: false,
    isAnonymous: false,
    createdAt: '2026-04-24T21:00:00Z',
    updatedAt: '2026-04-24T21:00:00Z',
  },
  {
    id: 'comment-003',
    postId: 'post-004',
    authorId: 'user-103',
    authorNickname: '橙子',
    content: '你可以先来坐一会儿，不一定每次都要“很有参与感”。',
    likes: 4,
    isLiked: false,
    isAnonymous: false,
    createdAt: '2026-04-23T19:30:00Z',
    updatedAt: '2026-04-23T19:30:00Z',
  },
  {
    id: 'comment-004',
    postId: 'post-005',
    authorId: 'user-104',
    authorNickname: '便签爱好者',
    content: '每次看这面墙都想偷偷给陌生人留一句“辛苦了”。',
    likes: 2,
    isLiked: false,
    isAnonymous: false,
    createdAt: '2026-04-22T18:00:00Z',
    updatedAt: '2026-04-22T18:00:00Z',
  },
];

export const siteConfigSeedData: SiteConfigRecord = {
  ownerName: '橙子',
  ownerAvatar: img.img24,
  ownerBio: '互联网大厂裸辞，徒手爆改 80m² 社畜快乐屋的 ENFJ 理想主义体验派',
  spaceImage: img.img29,
  spaceDescription:
    '深圳南山大新站 D 口附近的一间 80m² 社畜快乐屋，沙发客厅、投影角、手作桌和留言墙把每次相遇都变成像回家一样的松弛体验。',
  videoFinderUserName: 'sph_worker_house_demo',
  videoFeedId: '',
  videoCover: img.img17,
  videoTitle: '社畜快乐屋客厅放映夜',
  finderUserName: 'sph_worker_house_demo',
  videoLink: 'https://channels.weixin.qq.com',
};
