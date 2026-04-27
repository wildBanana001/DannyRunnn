import request from '@/services/request';

export interface AdminUploadResponse {
  fileID: string;
  name: string;
  size: number;
  url: string;
}

function joinUrl(base: string, suffix: string) {
  return `${base.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

export function getAdminUploadEndpoint() {
  const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

  if (/^https?:\/\//.test(rawBaseUrl)) {
    return joinUrl(rawBaseUrl, 'admin/upload');
  }

  if (rawBaseUrl.startsWith('/')) {
    return joinUrl(`${window.location.origin}${rawBaseUrl}`, 'admin/upload');
  }

  return joinUrl(`${window.location.origin}/${rawBaseUrl}`, 'admin/upload');
}

export async function uploadImageFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await request.post<AdminUploadResponse>('/admin/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000,
  });

  return data;
}
