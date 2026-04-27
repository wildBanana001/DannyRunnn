import { request } from './request';

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

export function wxLogin() {
  return request<WxLoginResult>({
    header: jsonHeaders,
    method: 'POST',
    path: '/api/auth/wx-login',
  });
}

export function wxUpdateProfile(payload: { nickname: string; avatar: string }) {
  return request<WxUserProfile>({
    data: payload,
    header: jsonHeaders,
    method: 'POST',
    path: '/api/auth/wx-profile',
  });
}

export function wxGetMe() {
  return request<WxUserProfile>({
    path: '/api/auth/wx-me',
  });
}
