import Taro from '@tarojs/taro';
import { request } from './request';

export interface UploadedImage {
  fileID: string;
  name: string;
  size: number;
  url: string;
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
          } as UploadedImage;
        }
      }
    }
  } catch (error) {
    console.error('cloud.uploadFile failed, falling back to base64:', error);
  }

  const fileName = filePath.split('/').pop() || `post-${timestamp}.jpg`;
  const base64 = await readFileAsBase64(filePath);

  return request<UploadedImage>({
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
}
