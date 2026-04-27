import type { User, UserRegistration, UserStats } from '@/types/user';

export const currentUser: User = {
  id: 'user-current',
  nickname: '香蕉',
  avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=320&q=80',
  phone: '138****8888',
  wechatId: 'banana_worker_house',
  isLoggedIn: true,
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-04-25T08:00:00Z'
};

export const userRegistrations: UserRegistration[] = [
  {
    id: 'reg-001',
    activityId: 'act-001',
    activityTitle: '复古拼贴夜谈会',
    activityCover: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80',
    status: 'paid',
    paymentAmount: 168,
    paymentTime: '2026-04-24T10:30:00Z',
    createdAt: '2026-04-24T10:30:00Z'
  },
  {
    id: 'reg-002',
    activityId: 'act-002',
    activityTitle: '旧胶片摄影散步',
    activityCover: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
    status: 'pending',
    paymentAmount: 99,
    createdAt: '2026-04-25T09:00:00Z'
  },
  {
    id: 'reg-003',
    activityId: 'act-101',
    activityTitle: '春日咖啡拼盘手作',
    activityCover: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    status: 'confirmed',
    paymentAmount: 128,
    paymentTime: '2026-04-10T14:00:00Z',
    createdAt: '2026-04-10T14:00:00Z'
  }
];

export const userStats: UserStats = {
  registrationsCount: 8,
  attendedCount: 5,
  postsCount: 12,
  likesReceived: 286
};
