import dayjs from 'dayjs';
import type { Profile } from '@/types';

export const profileSeedData: Profile[] = [
  {
    id: 'profile-001',
    nickname: '温梨',
    gender: 'female',
    ageRange: '25-29',
    industry: '互联网',
    occupation: '产品经理',
    city: '上海',
    socialGoal: '想认识同样热爱慢生活与身心平衡的朋友',
    introduction:
      '平时在徐汇上班，周末喜欢瑜伽、短途徒步和安静看展，希望逐步找回工作之外的节奏感。',
    wechatName: 'wenli_pm',
    phone: '13800138021',
    tags: ['瑜伽', '徒步', '看展'],
    createdAt: '2026-03-18T10:24:00Z',
    updatedAt: '2026-04-23T08:11:00Z',
  },
  {
    id: 'profile-002',
    nickname: '方知夏',
    gender: 'female',
    ageRange: '30-34',
    industry: '品牌营销',
    occupation: '品牌策划',
    city: '上海',
    socialGoal: '希望扩展周末同城活动搭子，保持稳定社交',
    introduction: '喜欢咖啡、花艺和城市散步，平时经常做策展相关项目，想结识审美同频的伙伴。',
    wechatName: 'summer_fang',
    phone: '',
    tags: ['咖啡', '花艺', '城市散步'],
    createdAt: '2026-03-22T12:10:00Z',
    updatedAt: '2026-04-24T11:40:00Z',
  },
  {
    id: 'profile-003',
    nickname: '陈屿',
    gender: 'male',
    ageRange: '25-29',
    industry: '金融',
    occupation: '投资分析师',
    city: '上海',
    socialGoal: '想通过线下活动拓展兴趣圈，而不是只围绕工作聊天',
    introduction: '工作节奏快，最近在练习品酒和摄影，希望找到可以持续一起探索城市内容的人。',
    wechatName: 'chenyu_notes',
    phone: '13917380011',
    tags: ['红酒', '摄影', '城市探索'],
    createdAt: '2026-02-28T14:36:00Z',
    updatedAt: '2026-04-20T09:15:00Z',
  },
  {
    id: 'profile-004',
    nickname: '陆未蓝',
    gender: 'female',
    ageRange: '25-29',
    industry: '教育',
    occupation: '课程设计师',
    city: '珠海',
    socialGoal: '想在新城市建立稳定、舒服的熟人圈子',
    introduction: '去年从杭州搬来珠海，喜欢轻社交、读书会和小规模分享活动，希望慢慢认识真诚的人。',
    wechatName: 'lulu_in_blue',
    phone: '13726280008',
    tags: ['读书会', '轻社交', '手作'],
    createdAt: '2026-04-03T09:52:00Z',
    updatedAt: '2026-04-25T10:20:00Z',
  },
  {
    id: 'profile-005',
    nickname: '何清妍',
    gender: 'female',
    ageRange: '30-34',
    industry: '医疗健康',
    occupation: '康复治疗师',
    city: '珠海',
    socialGoal: '希望多参加户外和运动类活动，结识积极的人',
    introduction: '喜欢晨跑、游泳和健康饮食，对身心疗愈类课程也很感兴趣。',
    wechatName: 'qingyan_he',
    phone: '13676018819',
    tags: ['晨跑', '游泳', '健康饮食'],
    createdAt: '2026-03-11T16:08:00Z',
    updatedAt: '2026-04-18T12:32:00Z',
  },
  {
    id: 'profile-006',
    nickname: '赵西月',
    gender: 'other',
    ageRange: '25-29',
    industry: '创意设计',
    occupation: '插画师',
    city: '上海',
    socialGoal: '想找到能长期一起参加艺术活动的搭子',
    introduction: '自由职业后更需要稳定的线下连接，喜欢油画、陶艺和手作交换。',
    wechatName: 'xiyue_draws',
    phone: '13564001256',
    tags: ['油画', '陶艺', '插画'],
    createdAt: '2026-02-20T08:18:00Z',
    updatedAt: '2026-04-16T07:50:00Z',
  },
];

const profiles = [...profileSeedData];

export function listProfiles() {
  return [...profiles].sort(
    (first, second) => dayjs(second.createdAt).valueOf() - dayjs(first.createdAt).valueOf(),
  );
}

export function findProfileById(id: string) {
  return profiles.find((profile) => profile.id === id) ?? null;
}
