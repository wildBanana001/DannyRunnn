import request from '@/services/request';
import type { AuthUser } from '@/store/authStore';

interface LoginPayload {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

interface ProfileResponse {
  user: AuthUser;
}

interface LogoutResponse {
  success: boolean;
}

export async function login(payload: LoginPayload) {
  const { data } = await request.post<LoginResponse>('/auth/login', payload);
  return data;
}

export async function getProfile() {
  const { data } = await request.get<ProfileResponse>('/auth/profile');
  return data;
}

export async function logout() {
  const { data } = await request.post<LogoutResponse>('/auth/logout');
  return data;
}
