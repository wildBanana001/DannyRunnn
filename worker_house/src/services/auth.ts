import {
  getMockWxLoginResult,
  getMockWxUserProfile,
  updateMockWxUserProfile,
} from '@/data/mock-member';
import type { WxLoginResult, WxUserProfile } from '@/types/auth';
import { getApiMode, request } from './request';

export type { WxLoginResult, WxUserProfile } from '@/types/auth';

const jsonHeaders = {
  'content-type': 'application/json',
};

export async function wxLogin(): Promise<WxLoginResult> {
  if (getApiMode() === 'mock') {
    return getMockWxLoginResult();
  }

  return request<WxLoginResult>({
    header: jsonHeaders,
    method: 'POST',
    path: '/api/auth/wx-login',
  });
}

export async function wxUpdateProfile(payload: { nickname: string; avatar: string }): Promise<WxUserProfile> {
  if (getApiMode() === 'mock') {
    return updateMockWxUserProfile(payload);
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
    return getMockWxUserProfile();
  }

  return request<WxUserProfile>({
    path: '/api/auth/wx-me',
  });
}
