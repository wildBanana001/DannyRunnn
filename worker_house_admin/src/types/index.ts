export type ActivityStatus = 'upcoming' | 'ongoing' | 'ended';

export interface Activity {
  id: string;
  title: string;
  description: string;
  fullDescription: string;
  cover: string;
  coverImage: string;
  covers: string[];
  gallery: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  address: string;
  price: number;
  originalPrice?: number;
  maxParticipants: number;
  currentParticipants: number;
  status: ActivityStatus;
  category: string;
  tags: string[];
  cardEligible: boolean;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  hostDescription: string;
  venueName: string;
  venueDescription: string;
  venueImages: string[];
  requirements: string[];
  includes: string[];
  refundPolicy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Host {
  id: string;
  name: string;
  avatar: string;
  description: string;
  background: string;
  activitiesCount: number;
  followersCount: number;
}

export interface Venue {
  id: string;
  name: string;
  description: string;
  images: string[];
  address: string;
  facilities: string[];
}

export type ProfileGender = 'female' | 'male' | 'other';

export interface Profile {
  id: string;
  nickname: string;
  gender: ProfileGender;
  ageRange: string;
  industry: string;
  occupation: string;
  city: string;
  socialGoal: string;
  introduction: string;
  wechatName: string;
  phone?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSnapshot {
  nickname: string;
  gender: ProfileGender;
  ageRange: string;
  industry: string;
  occupation: string;
  city: string;
  socialGoal: string;
  introduction: string;
}

export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Registration {
  id: string;
  activityId: string;
  activityTitle: string;
  profileId: string;
  participantNickname: string;
  wechatName: string;
  phone?: string;
  useCard: boolean;
  originalPrice: number;
  deductionAmount: number;
  amountPaid: number;
  status: RegistrationStatus;
  registeredAt: string;
  profileSnapshot: ProfileSnapshot;
}

export type CardOrderStatus = 'active' | 'expired' | 'refunded';
export type CardUsageStatus = 'used' | 'reverted';

export interface CardUsageLog {
  id: string;
  activityId: string;
  activityTitle: string;
  usedAt: string;
  deductionCount: number;
  deductionAmount: number;
  operatorName: string;
  status: CardUsageStatus;
  note?: string;
}

export interface CardOrder {
  id: string;
  profileId: string;
  userNickname: string;
  userWechatName: string;
  cardType: string;
  totalCount: number;
  usedCount: number;
  remainingCount: number;
  amount: number;
  purchasedAt: string;
  status: CardOrderStatus;
  expiresAt?: string;
  usageLogs: CardUsageLog[];
}

export * from './post';
export * from './poster';
export * from './site';
