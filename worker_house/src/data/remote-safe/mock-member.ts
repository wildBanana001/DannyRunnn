import type {
  CardOrder,
  CardUsageLog,
  Profile,
  ProfileFormValue,
  Registration,
  User,
} from '@/types';
import type { AdminFulfillmentTask, AdminIdentity } from '@/types/adminFulfillment';
import type { WxLoginResult, WxUserProfile } from '@/types/auth';
import type { SiteConfig } from '@/types/site';
import type { SiteConfigRecord } from '@/types/siteConfig';

interface RemoteSafeMemberState {
  profiles: Profile[];
  registrations: Registration[];
  cardOrder: CardOrder | null;
  cardUsageLogs: CardUsageLog[];
}

interface CreateRegistrationPayload {
  activityId: string;
  profileId: string;
  useCard: boolean;
}

const EMPTY_MEMBER_STATE: RemoteSafeMemberState = {
  profiles: [],
  registrations: [],
  cardOrder: null,
  cardUsageLogs: [],
};

const EMPTY_SITE_CONFIG_RECORD: SiteConfigRecord = {
  communityWallEnabled: false,
  communityQrcode: '',
  contactWechat: '',
  heroSlogan: '',
  heroTitle: '',
  aboutUs: '',
  homeCopyLead: '',
  homeCopyBody: '',
  homeChannelsFinder: '',
  homeOfficialAccountId: '',
  homeOfficialAccountName: '',
  homeSpaceImages: [],
  homeOwners: [],
  updatedAt: '',
  updatedBy: '',
};

const EMPTY_LEGACY_SITE_CONFIG: SiteConfig = {
  videoCover: '',
  videoLink: '',
  finderUserName: '',
  videos: [],
  spaceImage: '',
  spaceDescription: '',
  ownerAvatar: '',
  ownerName: '',
  ownerBio: '',
  title: '',
};

const EMPTY_USER: User = {
  id: '',
  nickname: '',
  avatar: '',
  isLoggedIn: false,
};

const rejectMockMutation = (): never => {
  throw new Error('远端构建不允许调用本地会员 mock 写入');
};

// Non-mock bundles resolve '@/data/mock-member' to this data-free surface.
export const MOCK_PERSONAL_CACHE_KEYS: readonly string[] = [];
export const getMockMemberState = (): RemoteSafeMemberState => EMPTY_MEMBER_STATE;
export const calculateCardDeduction = (
  _price: number,
  _useCard: boolean,
  _cardEligible: boolean,
  _remaining: number,
): number => 0;
export const getMockProfiles = (): Profile[] => [];
export const getMockRegistrations = (): Registration[] => [];
export const getMockRegistrationDetail = (_id: string): Registration | null => null;
export const getMockCurrentCard = (): CardOrder | null => null;
export const getMockCardUsageLogs = (): CardUsageLog[] => [];

export const upsertMockProfile = (
  _payload: ProfileFormValue & { id?: string },
): Profile => rejectMockMutation();
export const deleteMockProfile = (_id: string): Profile[] => rejectMockMutation();
export const setMockDefaultProfile = (_id: string): Profile[] => rejectMockMutation();
export const buyMockCard = (): CardOrder => rejectMockMutation();
export const createMockRegistration = (
  _payload: CreateRegistrationPayload,
): Registration => rejectMockMutation();

export const getMockWxLoginResult = (): WxLoginResult => rejectMockMutation();
export const getMockWxUserProfile = (): WxUserProfile => rejectMockMutation();
export const updateMockWxUserProfile = (
  _payload: { nickname: string; avatar: string },
): WxUserProfile => rejectMockMutation();

export const getMockAdminIdentity = (): AdminIdentity => ({ isAdmin: false, openid: '' });
export const getMockAdminFulfillmentTasks = (): AdminFulfillmentTask[] => [];
export const completeMockAdminFulfillmentTask = (
  _task: AdminFulfillmentTask,
): AdminFulfillmentTask => rejectMockMutation();

export const getMockSiteConfigRecord = (): SiteConfigRecord => ({
  ...EMPTY_SITE_CONFIG_RECORD,
  homeSpaceImages: [],
  homeOwners: [],
});
export const getMockLegacySiteConfig = (): SiteConfig => ({
  ...EMPTY_LEGACY_SITE_CONFIG,
  videos: [],
});
export const getMockCurrentUser = (): User => ({ ...EMPTY_USER });
export const getMockLoginPreset = (): { nickname: string; avatar: string } => ({
  nickname: '',
  avatar: '',
});
