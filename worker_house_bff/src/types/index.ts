export type ActivityStatus = 'upcoming' | 'ongoing' | 'ended';
export type ProfileGender = 'female' | 'male' | 'other';
export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded';
export type CardOrderStatus = 'active' | 'exhausted' | 'expired' | 'refunded';
export type CardUsageStatus = 'used' | 'reverted';
export type CardPackageStatus = 'active' | 'archived';

export interface AdminRecord {
  id: string;
  name: string;
  password: string;
  role: string;
  token: string;
  username: string;
}

export interface PosterRecord {
  id: string;
  title: string;
  coverImage: string;
  detailImages: string[];
  enabled: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryRecord {
  id: string;
  title: string;
  cover: string;
  excerpt: string;
  content?: string;
  publishAt: string;
  author?: string;
  sourceUrl?: string;
}

export interface ActivitySignupRecord {
  id: string;
  nickname: string;
  phone: string;
  wechatId: string;
  openid?: string;
  unionid?: string;
  createdAt: string;
  status?: string;
}

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
  address?: string;
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
  signups?: ActivitySignupRecord[];
  createdAt: string;
  updatedAt: string;
  enabled?: boolean;
  sort?: number;
}

export interface ActivityRecord extends Omit<Activity, 'cardEligible' | 'cover' | 'covers'> {
  cardEligible?: boolean;
  cover?: string;
  covers?: string[];
}

export interface PostRecord {
  id: string;
  authorId: string;
  authorNickname: string;
  authorAvatar?: string;
  title?: string;
  content: string;
  images: string[];
  likes: number;
  comments: number;
  commentsCount?: number;
  isLiked: boolean;
  isAnonymous: boolean;
  tags: string[];
  color?: 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';
  isPinned?: boolean;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  authorNickname: string;
  authorAvatar?: string;
  content: string;
  likes: number;
  isLiked: boolean;
  isAnonymous: boolean;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteConfigRecord {
  ownerName: string;
  ownerAvatar: string;
  ownerBio: string;
  spaceImage: string;
  spaceDescription: string;
  videoFinderUserName: string;
  videoFeedId: string;
  videoCover: string;
  videoTitle: string;
  finderUserName?: string;
  videoLink?: string;
}

export interface Profile {
  id: string;
  openid: string;
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
  isDefault: boolean;
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

export interface Registration {
  id: string;
  openid: string;
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
  openid: string;
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
