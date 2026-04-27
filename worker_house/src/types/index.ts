export type ActivityStatus = 'upcoming' | 'ongoing' | 'ended';
export type RegistrationStatus = 'pending' | 'paid' | 'confirmed' | 'cancelled' | 'completed' | 'refunded';
export type ProfileGender = 'male' | 'female' | 'other';
export type CardOrderStatus = 'active' | 'exhausted' | 'expired' | 'refunded';
export type CardUsageStatus = 'used' | 'reverted';
export type CardPackageStatus = 'active' | 'archived';

export interface Activity {
  id: string;
  _id?: string;
  title: string;
  description: string;
  fullDescription: string;
  coverImage: string;
  gallery: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  price: number;
  originalPrice?: number;
  maxParticipants: number;
  currentParticipants: number;
  status: ActivityStatus;
  category: string;
  tags: string[];
  hostId: string;
  hostName: string;
  hostAvatar: string;
  hostDescription: string;
  requirements: string[];
  includes: string[];
  refundPolicy: string;
  createdAt: string;
  updatedAt: string;
  enabled?: boolean;
  sort?: number;
  cover?: string;
  covers?: string[];
  cardEligible?: boolean;
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
  facilities: string[];
}

export interface User {
  id: string;
  nickname: string;
  avatar?: string;
  phone?: string;
  wechatId?: string;
  openid?: string;
  isAdmin?: boolean;
  isLoggedIn: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Profile {
  id: string;
  openid?: string;
  nickname: string;
  gender?: ProfileGender;
  ageRange: string;
  industry: string;
  occupation: string;
  city: string;
  socialGoal: string;
  introduction: string;
  wechatName: string;
  phone?: string;
  tags: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProfileFormValue = Omit<Profile, 'id' | 'createdAt' | 'updatedAt' | 'isDefault' | 'openid'> & {
  isDefault?: boolean;
};

export interface ProfileSnapshot {
  nickname: string;
  gender?: ProfileGender;
  ageRange: string;
  industry: string;
  occupation: string;
  city: string;
  socialGoal: string;
  introduction: string;
}

export interface Registration {
  id: string;
  activityId: string;
  activityTitle: string;
  activityCover: string;
  profileId: string;
  participantNickname: string;
  wechatName: string;
  phone?: string;
  useCard: boolean;
  originalPrice: number;
  cardOffset: number;
  payable: number;
  deductionAmount: number;
  amountPaid: number;
  status: RegistrationStatus;
  registeredAt: string;
  createdAt?: string;
  updatedAt?: string;
  profileSnapshot: ProfileSnapshot;
  cardOrderId?: string;
  cardUsageLogId?: string;
  activity?: Activity | null;
  activitySnapshot?: Activity | null;
  priceBreakdown?: {
    amountPaid: number;
    cardOffset: number;
    originalPrice: number;
    payable: number;
  };
}

export interface CardUsageLog {
  id: string;
  registrationId?: string;
  activityId: string;
  activityTitle: string;
  usedAt: string;
  deductionCount: number;
  deductionAmount: number;
  operatorName: string;
  status: CardUsageStatus;
  note?: string;
}

export interface CardOrderAdjustLog {
  at: string;
  by: string;
  from: Partial<Pick<CardOrder, 'remainingCount' | 'expiresAt' | 'status'>>;
  reason: string;
  to: Partial<Pick<CardOrder, 'remainingCount' | 'expiresAt' | 'status'>>;
}

export interface CardOrder {
  id: string;
  openid?: string;
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
  usageLogs: CardUsageLog[];
  expiresAt?: string;
  packageId?: string;
  perUseMaxOffset?: number;
  validDays?: number;
  adjustLogs?: CardOrderAdjustLog[];
}

export interface CardPackage {
  id: string;
  name: string;
  totalCount: number;
  price: number;
  perUseMaxOffset: number;
  validDays: number;
  status: CardPackageStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Story {
  id: string;
  title: string;
  cover: string;
  excerpt: string;
  content?: string;
  publishAt: string;
  author?: string;
  sourceUrl?: string;
}

export interface UserStats {
  registrationsCount: number;
  attendedCount: number;
  postsCount: number;
  likesReceived: number;
}
