import Taro from '@tarojs/taro';
import type { Activity, CardOrder, CardPackage, Registration, RegistrationStatus, Story } from '@/types';
import type { Post } from '@/types/post';
import { request } from './request';

const jsonHeaders = {
  'content-type': 'application/json',
};

export interface AdminCheckResult {
  isAdmin: boolean;
  openid: string;
}

export interface AdminPagedResult<T> {
  data?: T[];
  list: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminStatsResult {
  activities: {
    total: number;
    ongoing: number;
    ended: number;
  };
  posts: {
    total: number;
  };
  registrations: {
    total: number;
  };
  cardOrders: {
    total: number;
  };
}

export interface AdminMiniPost extends Omit<Post, '_id'> {
  isPinned?: boolean;
}

export type AdminPosterStatus = 'online' | 'offline';

export interface AdminMiniPoster {
  id: string;
  title: string;
  coverImage: string;
  detailImages?: string[];
  enabled?: boolean;
  linkUrl: string;
  relatedActivityId: string;
  status: AdminPosterStatus;
  sort?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface UploadedAdminImage {
  fileID: string;
  name: string;
  size: number;
  url: string;
}

export type AdminActivityPayload = Partial<Activity> & {
  maxParticipants?: number | string;
  price?: number | string;
};

export type AdminPosterPayload = Partial<AdminMiniPoster> & {
  title?: string;
  coverImage?: string;
  linkUrl?: string;
  relatedActivityId?: string;
  status?: AdminPosterStatus;
};

export interface AdminMiniStory extends Story {}

export type AdminStoryPayload = Partial<AdminMiniStory> & {
  title?: string;
  cover?: string;
  excerpt?: string;
  content?: string;
  publishAt?: string;
  author?: string;
  sourceUrl?: string;
};

export interface AdminRegistrationsQuery {
  activityId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  status?: RegistrationStatus;
}

export interface AdminCardOrdersQuery {
  cardType?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  status?: CardOrder['status'];
  userId?: string;
}

export interface AdminRegistrationDetail extends Registration {
  activitySnapshot?: Activity | null;
  cardOrder?: CardOrder | null;
  cardUsageLog?: CardOrder['usageLogs'][number] | null;
  priceBreakdown?: {
    amountPaid: number;
    cardOffset: number;
    originalPrice: number;
    payable: number;
  };
}

export interface AdminCardOrderDetail extends CardOrder {
  usageLogs: CardOrder['usageLogs'];
}

export interface AdminCardOrderUpdatePayload {
  expiresAt?: string;
  reason?: string;
  remainingCount?: number;
  status?: CardOrder['status'];
}

export type AdminCardPackagePayload = Partial<CardPackage> & {
  name?: string;
  totalCount?: number | string;
  price?: number | string;
  perUseMaxOffset?: number | string;
  validDays?: number | string;
  sortOrder?: number | string;
};

function readFileAsBase64(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      encoding: 'base64',
      fail: reject,
      filePath,
      success: (result) => {
        resolve(String(result.data));
      },
    });
  });
}

function guessContentType(filePath: string) {
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (extension === 'png') {
    return 'image/png';
  }
  if (extension === 'webp') {
    return 'image/webp';
  }
  if (extension === 'gif') {
    return 'image/gif';
  }
  return 'image/jpeg';
}

function adminRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', path: string, data?: unknown) {
  return request<T>({
    data,
    header: jsonHeaders,
    method,
    path,
  });
}

function buildQueryString(query: Record<string, string | number | undefined>) {
  const search = Object.entries(query)
    .filter(([, value]) => typeof value !== 'undefined' && `${value}`.trim() !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return search ? `?${search}` : '';
}

function unwrapData<T>(payload: T | { data: T }) {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function checkMiniAdmin() {
  await Taro.login();
  return adminRequest<AdminCheckResult>('POST', '/api/admin-mini/check');
}

export async function fetchAdminStats() {
  return adminRequest<AdminStatsResult>('GET', '/api/admin-mini/stats');
}

export async function fetchAdminActivities(page = 1, pageSize = 100) {
  return adminRequest<AdminPagedResult<Activity>>(
    'GET',
    `/api/admin-mini/activities?page=${page}&pageSize=${pageSize}`,
  );
}

export async function createAdminActivity(payload: AdminActivityPayload) {
  return adminRequest<Activity>('POST', '/api/admin-mini/activities', payload);
}

export async function updateAdminActivity(id: string, payload: AdminActivityPayload) {
  return adminRequest<Activity>('PUT', `/api/admin-mini/activities/${encodeURIComponent(id)}`, payload);
}

export async function deleteAdminActivity(id: string) {
  return adminRequest<{ success: boolean }>('DELETE', `/api/admin-mini/activities/${encodeURIComponent(id)}`);
}

export async function fetchAdminPosts(page = 1, pageSize = 100) {
  return adminRequest<AdminPagedResult<AdminMiniPost>>(
    'GET',
    `/api/admin-mini/posts?page=${page}&pageSize=${pageSize}`,
  );
}

export async function deleteAdminPost(id: string) {
  return adminRequest<{ success: boolean }>('DELETE', `/api/admin-mini/posts/${encodeURIComponent(id)}`);
}

export async function updateAdminPostPinned(id: string, pinned: boolean) {
  return adminRequest<AdminMiniPost>('PUT', `/api/admin-mini/posts/${encodeURIComponent(id)}/pin`, { pinned });
}

export async function fetchAdminPosters(page = 1, pageSize = 100) {
  return adminRequest<AdminPagedResult<AdminMiniPoster>>(
    'GET',
    `/api/admin-mini/posters?page=${page}&pageSize=${pageSize}`,
  );
}

export async function createAdminPoster(payload: AdminPosterPayload) {
  return adminRequest<AdminMiniPoster>('POST', '/api/admin-mini/posters', payload);
}

export async function updateAdminPoster(id: string, payload: AdminPosterPayload) {
  return adminRequest<AdminMiniPoster>('PUT', `/api/admin-mini/posters/${encodeURIComponent(id)}`, payload);
}

export async function deleteAdminPoster(id: string) {
  return adminRequest<{ success: boolean }>('DELETE', `/api/admin-mini/posters/${encodeURIComponent(id)}`);
}

export async function updateAdminPosterStatus(id: string, status: AdminPosterStatus) {
  return adminRequest<AdminMiniPoster>('PUT', `/api/admin-mini/posters/${encodeURIComponent(id)}/status`, { status });
}

export async function fetchAdminStories(page = 1, pageSize = 100) {
  return adminRequest<AdminPagedResult<AdminMiniStory>>(
    'GET',
    `/api/admin-mini/stories?page=${page}&pageSize=${pageSize}`,
  );
}

export async function createAdminStory(payload: AdminStoryPayload) {
  return adminRequest<AdminMiniStory>('POST', '/api/admin-mini/stories', payload);
}

export async function updateAdminStory(id: string, payload: AdminStoryPayload) {
  return adminRequest<AdminMiniStory>('PUT', `/api/admin-mini/stories/${encodeURIComponent(id)}`, payload);
}

export async function deleteAdminStory(id: string) {
  return adminRequest<{ success: boolean }>('DELETE', `/api/admin-mini/stories/${encodeURIComponent(id)}`);
}

export async function fetchAdminRegistrations(query: AdminRegistrationsQuery = {}) {
  const search = buildQueryString({
    activityId: query.activityId,
    keyword: query.keyword,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    status: query.status,
  });
  return adminRequest<AdminPagedResult<Registration>>('GET', `/api/admin-mini/registrations${search}`);
}

export async function fetchAdminRegistrationDetail(id: string) {
  const result = await adminRequest<{ data: AdminRegistrationDetail }>('GET', `/api/admin-mini/registrations/${encodeURIComponent(id)}`);
  return unwrapData(result);
}

export async function updateAdminRegistrationStatus(id: string, status: RegistrationStatus) {
  const result = await adminRequest<{ data: AdminRegistrationDetail }>('PATCH', `/api/admin-mini/registrations/${encodeURIComponent(id)}/status`, { status });
  return unwrapData(result);
}

export async function fetchAdminCardOrders(query: AdminCardOrdersQuery = {}) {
  const search = buildQueryString({
    cardType: query.cardType,
    keyword: query.keyword,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    status: query.status,
    userId: query.userId,
  });
  return adminRequest<AdminPagedResult<CardOrder>>('GET', `/api/admin-mini/card-orders${search}`);
}

export async function fetchAdminCardOrderDetail(id: string) {
  const result = await adminRequest<{ data: AdminCardOrderDetail }>('GET', `/api/admin-mini/card-orders/${encodeURIComponent(id)}`);
  return unwrapData(result);
}

export async function updateAdminCardOrder(id: string, payload: AdminCardOrderUpdatePayload) {
  const result = await adminRequest<{ data: AdminCardOrderDetail }>('PATCH', `/api/admin-mini/card-orders/${encodeURIComponent(id)}`, payload);
  return unwrapData(result);
}

export async function fetchAdminCardPackages() {
  const result = await adminRequest<{ data?: CardPackage[]; list: CardPackage[]; total: number }>('GET', '/api/admin-mini/card-packages');
  return {
    data: result.data ?? result.list,
    list: result.list,
    total: result.total,
  };
}

export async function createAdminCardPackage(payload: AdminCardPackagePayload) {
  const result = await adminRequest<{ data: CardPackage }>('POST', '/api/admin-mini/card-packages', payload);
  return unwrapData(result);
}

export async function updateAdminCardPackage(id: string, payload: AdminCardPackagePayload) {
  const result = await adminRequest<{ data: CardPackage }>('PUT', `/api/admin-mini/card-packages/${encodeURIComponent(id)}`, payload);
  return unwrapData(result);
}

export async function deleteAdminCardPackage(id: string) {
  const result = await adminRequest<{ data: CardPackage }>('DELETE', `/api/admin-mini/card-packages/${encodeURIComponent(id)}`);
  return unwrapData(result);
}

export async function uploadAdminCoverImage(filePath: string) {
  const extension = filePath.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const cloudPath = `worker-house/admin/${yyyy}${MM}${dd}/${timestamp}-${rand}.${extension}`;

  try {
    const cloudApi = (Taro as any).cloud || (typeof wx !== 'undefined' ? (wx as any).cloud : null);
    if (cloudApi) {
      const uploadRes = await cloudApi.uploadFile({
        cloudPath,
        filePath,
      });
      
      if (uploadRes.fileID) {
        const tempRes = await cloudApi.getTempFileURL({
          fileList: [uploadRes.fileID],
        });
        const tempFile = tempRes.fileList[0];
        if (tempFile && tempFile.tempFileURL) {
          return {
            fileID: uploadRes.fileID,
            url: tempFile.tempFileURL,
            name: cloudPath,
            size: 0,
          } as UploadedAdminImage;
        }
      }
    }
  } catch (error) {
    console.error('cloud.uploadFile admin failed, falling back to base64:', error);
  }

  const fileName = filePath.split('/').pop() || `activity-${timestamp}.jpg`;
  const base64 = await readFileAsBase64(filePath);
  return adminRequest<UploadedAdminImage>('POST', '/api/admin-mini/upload', {
    base64,
    contentType: guessContentType(filePath),
    fileName,
  });
}
