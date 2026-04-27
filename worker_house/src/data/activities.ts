import type { Activity, Host, Venue } from '@/types';
import { wechatArticleImageUrls } from './wechat-images';

const sharedHostId = 'host-orange';
const sharedHostName = '橙子';
const sharedHostAvatar = wechatArticleImageUrls.img24;
const sharedHostDescription = '互联网大厂裸辞后徒手爆改 80m² 社畜快乐屋的 ENFJ 理想主义体验派。';
const sharedRefundPolicy =
  '活动开始前 3 小时可申请保留名额到下次使用；临时取消将收取 50% 手续费。活动现场会拍照记录，如不希望出镜请提前告知主理人。';

const buildActivity = (activity: Activity): Activity => ({
  ...activity,
  cover: activity.cover || activity.coverImage,
  covers: activity.covers && activity.covers.length > 0 ? activity.covers : [activity.cover || activity.coverImage, ...activity.gallery],
  cardEligible: activity.cardEligible ?? false
});

export const ongoingActivities: Activity[] = [
  buildActivity({
    id: 'act-001',
    _id: 'act-001',
    title: '5.10 周六晚 · deeptalk：人生里的 N 种选择',
    description: '聊那些和主流成功叙事不完全一致、却依然诚实的选择。',
    fullDescription:
      '这一晚会围绕“人生里的 N 种选择”展开大型聊天局：上班还是考研、选高薪还是选轻松、选喜欢自己的还是自己喜欢的。橙子会分享自己从大厂上班、裸辞到开始经营社畜快乐屋的真实经历，也会把更多时间留给每个人说自己的版本。我们会在欢迎仪式、主题提问、开放分享和夸夸 time 里，把那些说不出口的犹豫慢慢讲开，让每个选择都被认真听见。',
    coverImage: wechatArticleImageUrls.img06,
    cover: wechatArticleImageUrls.img06,
    gallery: [wechatArticleImageUrls.img07],
    covers: [wechatArticleImageUrls.img06, wechatArticleImageUrls.img07],
    startDate: '2026-05-10',
    endDate: '2026-05-10',
    startTime: '19:30',
    endTime: '23:00',
    price: 148,
    originalPrice: 168,
    maxParticipants: 11,
    currentParticipants: 7,
    status: 'ongoing',
    category: 'deeptalk',
    tags: ['人生选择', '深度社交', '夸夸 time'],
    hostId: sharedHostId,
    hostName: sharedHostName,
    hostAvatar: sharedHostAvatar,
    hostDescription: sharedHostDescription,
    requirements: ['建议准时到场，方便完整参与破冰和欢迎仪式', '想匿名表达也可以，只需要给自己取一个当晚昵称', '如不想出镜或公开分享，可提前和主理人说一声'],
    includes: ['门票', '小食', '果桶 / 吨吨酒桶畅饮', '社畜周边 1 份', '夸夸环节仪式卡'],
    refundPolicy: sharedRefundPolicy,
    createdAt: '2026-04-26T09:30:00Z',
    updatedAt: '2026-04-26T09:30:00Z',
    enabled: true,
    sort: 1,
    cardEligible: true
  }),
  buildActivity({
    id: 'act-002',
    _id: 'act-002',
    title: '5.16 周五晚 · deeptalk：幸福的奥义',
    description: '从记忆里的幸福瞬间出发，重新定义什么才算“过得不错”。',
    fullDescription:
      '这场 deeptalk 想聊的不是标准答案里的幸福，而是每个人身体最诚实的感受。我们会从“你最近一次感到幸福是什么时候”开始，慢慢聊到工作、关系、家庭、自我照顾与期待落差。现场会有轻量破冰、幸福时刻卡片、自由分享和互相夸奖环节，让大家把那些很小、很日常、却足够支撑人的幸福重新捡回来。',
    coverImage: wechatArticleImageUrls.img08,
    cover: wechatArticleImageUrls.img08,
    gallery: [wechatArticleImageUrls.img09],
    covers: [wechatArticleImageUrls.img08, wechatArticleImageUrls.img09],
    startDate: '2026-05-16',
    endDate: '2026-05-16',
    startTime: '19:30',
    endTime: '23:00',
    price: 148,
    originalPrice: 168,
    maxParticipants: 11,
    currentParticipants: 6,
    status: 'ongoing',
    category: 'deeptalk',
    tags: ['幸福感', '疗愈聊天', '小组分享'],
    hostId: sharedHostId,
    hostName: sharedHostName,
    hostAvatar: sharedHostAvatar,
    hostDescription: sharedHostDescription,
    requirements: ['允许慢热，不需要强行外向', '可以带一个让你想起幸福的物件或照片', '活动会有拍照记录，不方便出镜可提前说明'],
    includes: ['门票', '小食', '果桶 / 吨吨酒桶畅饮', '社畜周边 1 份', '幸福时刻卡片'],
    refundPolicy: sharedRefundPolicy,
    createdAt: '2026-04-26T09:20:00Z',
    updatedAt: '2026-04-26T09:20:00Z',
    enabled: true,
    sort: 2,
    cardEligible: true
  }),
  ];

export const featuredActivity: Activity = ongoingActivities[0];
export const upcomingActivities: Activity[] = ongoingActivities;
export const allActivities: Activity[] = ongoingActivities;

export const hostInfo: Host = {
  id: sharedHostId,
  name: sharedHostName,
  avatar: sharedHostAvatar,
  description: '把客厅变成新新人类社交方式试验场的主理人。',
  background:
    '橙子从互联网大厂裸辞后，徒手爆改了这间 80m² 的社畜快乐屋。她相信人和人的真实链接不该被年龄、职业和关系标签限定，所以把 fun、共创、女性友好借宿和去标签化社交都做进了这间客厅里。',
  activitiesCount: 52,
  followersCount: 1314
};

export const venueInfo: Venue = {
  id: 'venue-shenzhen-worker-house',
  name: '社畜快乐屋·深圳社交化客厅',
  description: '位于深圳南山大新站 D 口附近的 80m² 共居客厅，白天像住家，晚上像会发光的社交试验场。',
  images: [
  ],
  facilities: ['沙发客厅', '投影幕布', '手作长桌', '留言墙', '女性友好留宿空间', '喵星人陪伴']
};
