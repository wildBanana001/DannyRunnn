import Taro from '@tarojs/taro';
import { getApiMode, request } from './request';
import type { ActivityImportResult, AdminActivity } from '@/types/adminActivity';

export type { ActivityImportResult, AdminActivity } from '@/types/adminActivity';

function requireBackend() {
  if (getApiMode() === 'mock') throw new Error('活动管理需要连接 BFF，请使用 bff 或 cloudrun 模式');
}

export async function fetchAdminActivities(page: number, keyword = '') {
  requireBackend();
  return request<{ list: AdminActivity[]; total: number }>({
    path: `/api/admin-mini/activities?page=${page}&pageSize=30&keyword=${encodeURIComponent(keyword)}`,
  });
}

export async function fetchAdminActivity(id: string) {
  requireBackend();
  return request<AdminActivity>({ path: `/api/admin-mini/activities/${encodeURIComponent(id)}` });
}

export async function importActivity(content: string) {
  requireBackend();
  return request<ActivityImportResult>({
    path: '/api/admin-mini/activities/import', method: 'POST', data: { type: 'text', content },
  });
}

export async function saveAdminActivity(id: string | undefined, data: Partial<AdminActivity>) {
  requireBackend();
  return request<AdminActivity>({
    path: id ? `/api/admin-mini/activities/${encodeURIComponent(id)}` : '/api/admin-mini/activities',
    method: id ? 'PUT' : 'POST', data,
  });
}

export async function uploadActivityCover() {
  requireBackend();
  const selected = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
  const filePath = selected.tempFilePaths[0];
  if (!filePath) throw new Error('未选择图片');
  let base64: string;
  if (process.env.TARO_ENV === 'weapp') {
    base64 = await new Promise<string>((resolve, reject) => {
      Taro.getFileSystemManager().readFile({
        filePath, encoding: 'base64',
        success: (result) => resolve(String(result.data)), fail: reject,
      });
    });
  } else {
    const blob = await (await fetch(filePath)).blob();
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(blob);
    });
  }
  if (base64.length > 10 * 1024 * 1024) throw new Error('图片过大，请选择小于 7MB 的图片');
  const extension = /\.(png|webp|gif)(?:\?|$)/i.exec(filePath)?.[1]?.toLowerCase() || 'jpeg';
  const result = await request<{ url: string }>({
    path: '/api/admin-mini/upload', method: 'POST',
    data: { base64, fileName: `activity-${Date.now()}.${extension}`, contentType: `image/${extension}` },
  });
  if (!result.url?.startsWith('https://')) throw new Error('图片上传未返回有效链接，请重试');
  return result.url;
}
