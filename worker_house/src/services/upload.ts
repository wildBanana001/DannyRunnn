import Taro from '@tarojs/taro';
import { getApiMode, request } from './request';

declare const wx: any;

export interface UploadedImage {
  fileID: string;
  name: string;
  size: number;
  url: string;
}

const TRACKED_POST_FILE_IDS_KEY = 'worker-house-post-file-ids:v1';
const DELETE_FILE_BATCH_SIZE = 50;

function getCloudApi() {
  return (Taro as any).cloud || (typeof wx !== 'undefined' ? (wx as any).cloud : null);
}

function getTrackedPostFileIds() {
  try {
    const value = Taro.getStorageSync<string[] | null>(TRACKED_POST_FILE_IDS_KEY);
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter((item) => item.startsWith('cloud://'))
      : [];
  } catch (error) {
    console.warn('[upload] read tracked file ids failed', error);
    return [];
  }
}

function saveTrackedPostFileIds(fileIds: string[]) {
  try {
    const uniqueFileIds = Array.from(new Set(fileIds.filter((item) => item.startsWith('cloud://'))));
    if (uniqueFileIds.length > 0) Taro.setStorageSync(TRACKED_POST_FILE_IDS_KEY, uniqueFileIds);
    else Taro.removeStorageSync(TRACKED_POST_FILE_IDS_KEY);
  } catch (error) {
    console.warn('[upload] persist tracked file ids failed', error);
  }
}

function trackPostFileId(fileID: string) {
  const normalizedFileId = fileID.trim();
  if (!normalizedFileId.startsWith('cloud://')) return;
  saveTrackedPostFileIds([...getTrackedPostFileIds(), normalizedFileId]);
}

export async function deleteTrackedPostImages(additionalFileIds: string[] = []) {
  const fileIds = Array.from(new Set(
    [...getTrackedPostFileIds(), ...additionalFileIds]
      .map((item) => String(item).trim())
      .filter((item) => item.startsWith('cloud://')),
  ));
  if (fileIds.length === 0) return [];

  const cloudApi = getCloudApi();
  if (!cloudApi?.deleteFile) return fileIds;

  const failures: string[] = [];
  for (let index = 0; index < fileIds.length; index += DELETE_FILE_BATCH_SIZE) {
    const fileList = fileIds.slice(index, index + DELETE_FILE_BATCH_SIZE);
    try {
      const response = await cloudApi.deleteFile({ fileList });
      const results = Array.isArray(response?.fileList) ? response.fileList : [];
      if (!results.length) continue;
      results.forEach((item: { errMsg?: string; fileID?: string; status?: number }) => {
        const errorMessage = String(item.errMsg || '').toLowerCase();
        const alreadyMissing = errorMessage.includes('not exist') || errorMessage.includes('不存在');
        if (Number(item.status) !== 0 && !alreadyMissing) failures.push(String(item.fileID || ''));
      });
    } catch (error) {
      console.warn('[upload] delete cloud files failed', error);
      failures.push(...fileList);
    }
  }

  const normalizedFailures = Array.from(new Set(failures.filter(Boolean)));
  saveTrackedPostFileIds(normalizedFailures);
  return normalizedFailures;
}

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

export async function uploadPostImage(filePath: string) {
  const extension = filePath.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const cloudPath = `worker-house/posts/${yyyy}${MM}${dd}/${timestamp}-${rand}.${extension}`;

  if (getApiMode() === 'mock') {
    return {
      fileID: '',
      url: filePath,
      name: filePath.split('/').pop() || `post-${timestamp}.${extension}`,
      size: 0,
    } as UploadedImage;
  }

  try {
    const cloudApi = getCloudApi();
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
          trackPostFileId(uploadRes.fileID);
          return {
            fileID: uploadRes.fileID,
            url: tempFile.tempFileURL,
            name: cloudPath,
            size: 0,
          } as UploadedImage;
        }
      }
    }
  } catch (error) {
    console.error('cloud.uploadFile failed, falling back to base64:', error);
  }

  const fileName = filePath.split('/').pop() || `post-${timestamp}.jpg`;
  const base64 = await readFileAsBase64(filePath);

  const uploaded = await request<UploadedImage>({
    data: {
      base64,
      contentType: guessContentType(filePath),
      fileName,
    },
    header: {
      'content-type': 'application/json',
    },
    method: 'POST',
    path: '/api/upload',
  });
  trackPostFileId(uploaded.fileID || '');
  return uploaded;
}
