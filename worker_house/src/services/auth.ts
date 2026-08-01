import Taro from '@tarojs/taro';
import { getApiMode, request } from './request';

const jsonHeaders = {
  'content-type': 'application/json',
};

export interface WxLoginResult {
  openid: string;
  nickname: string;
  avatar: string;
  isAdmin: boolean;
  isNew: boolean;
}

export interface WxUserProfile {
  openid: string;
  nickname: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
}

const MOCK_USER_STORAGE_KEY = 'worker-house-mock-wx-user';
const MOCK_OPENID = 'mock_openid_001';

function getMockUser(): WxUserProfile | null {
  const cached = Taro.getStorageSync<WxUserProfile | null>(MOCK_USER_STORAGE_KEY);
  return cached?.openid ? cached : null;
}

export async function wxLogin(): Promise<WxLoginResult> {
  if (getApiMode() === 'mock') {
    const user = getMockUser();
    return {
      openid: MOCK_OPENID,
      nickname: user?.nickname ?? '',
      avatar: user?.avatar ?? '',
      isAdmin: false,
      isNew: !user,
    };
  }

  return request<WxLoginResult>({
    header: jsonHeaders,
    method: 'POST',
    path: '/api/auth/wx-login',
  });
}

export async function wxUpdateProfile(payload: { nickname: string; avatar: string }): Promise<WxUserProfile> {
  if (getApiMode() === 'mock') {
    const current = getMockUser();
    const timestamp = new Date().toISOString();
    const user: WxUserProfile = {
      openid: MOCK_OPENID,
      nickname: payload.nickname.trim(),
      avatar: payload.avatar.trim(),
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    Taro.setStorageSync(MOCK_USER_STORAGE_KEY, user);
    return user;
  }

  return request<WxUserProfile>({
    data: payload,
    header: jsonHeaders,
    method: 'POST',
    path: '/api/auth/wx-profile',
  });
}

export async function wxGetMe(): Promise<WxUserProfile> {
  if (getApiMode() === 'mock') {
    const user = getMockUser();
    if (!user) {
      throw new Error('mock 用户尚未登录');
    }
    return user;
  }

  return request<WxUserProfile>({
    path: '/api/auth/wx-me',
  });
}
