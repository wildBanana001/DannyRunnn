import Taro from '@tarojs/taro';
import { allActivities } from '@/data/activities';
import { posts } from '@/data/posts';
import { currentUser, userRegistrations, userStats } from '@/data/users';

export interface ProfileAddress {
  id: string;
  recipient: string;
  phone: string;
  region: string;
  detailAddress: string;
  isDefault: boolean;
}

export const profileOverviewStats = {
  registrationsCount: userStats.registrationsCount,
  postsCount: posts.filter((item) => item.authorId === currentUser.id).length,
  likesReceived: userStats.likesReceived
};

export const profileRegistrations = userRegistrations.map((item) => ({
  ...item,
  activity: allActivities.find((activity) => activity.id === item.activityId) ?? allActivities[0]
}));

export const profilePosts = posts.filter((item) => item.authorId === currentUser.id);

const addressSeedData: ProfileAddress[] = [
  {
    id: 'address-001',
    recipient: '林凯锋',
    phone: '13800138000',
    region: '上海市 徐汇区 徐家汇街道',
    detailAddress: '漕溪北路 398 号 5 楼 501 室',
    isDefault: true
  },
  {
    id: 'address-002',
    recipient: '香蕉',
    phone: '13900139000',
    region: '上海市 静安区 静安寺街道',
    detailAddress: '胶州路 118 弄 12 号 201',
    isDefault: false
  }
];

const ADDRESS_STORAGE_KEY = 'worker-house-profile-addresses';

const normalizeAddressList = (list: ProfileAddress[]): ProfileAddress[] => {
  const nextList = list.map((item, index) => ({
    ...item,
    isDefault: index === 0 ? true : item.isDefault
  }));

  if (!nextList.some((item) => item.isDefault) && nextList[0]) {
    nextList[0].isDefault = true;
  }

  const defaultAddress = nextList.find((item) => item.isDefault);
  const rest = nextList.filter((item) => item.id !== defaultAddress?.id);
  return defaultAddress ? [defaultAddress, ...rest.map((item) => ({ ...item, isDefault: false }))] : nextList;
};

export const getProfileAddresses = (): ProfileAddress[] => {
  const cached = Taro.getStorageSync(ADDRESS_STORAGE_KEY);
  if (Array.isArray(cached) && cached.length > 0) {
    return normalizeAddressList(cached as ProfileAddress[]);
  }
  return addressSeedData;
};

export const saveProfileAddresses = (list: ProfileAddress[]) => {
  const normalized = normalizeAddressList(list);
  Taro.setStorageSync(ADDRESS_STORAGE_KEY, normalized);
  return normalized;
};

export const upsertProfileAddress = (address: ProfileAddress) => {
  const currentList = getProfileAddresses();
  const nextList = currentList.some((item) => item.id === address.id)
    ? currentList.map((item) => (item.id === address.id ? address : item))
    : [address, ...currentList];
  return saveProfileAddresses(nextList);
};

export const removeProfileAddress = (id: string) => {
  const nextList = getProfileAddresses().filter((item) => item.id !== id);
  return saveProfileAddresses(nextList);
};

export const buildProfileAddressDraft = (): ProfileAddress => ({
  id: `address-${Date.now()}`,
  recipient: '',
  phone: '',
  region: '',
  detailAddress: '',
  isDefault: false
});
