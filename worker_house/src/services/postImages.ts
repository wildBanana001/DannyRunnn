import Taro from '@tarojs/taro';
import { initCloud } from '@/cloud';
import type { Post } from '@/types/post';

declare const wx: any;

interface TempFileResult {
  fileID?: string;
  status?: number;
  tempFileURL?: string;
}

interface CachedFileUrl {
  expiresAt: number;
  url: string;
}

interface DownloadFileResult {
  tempFilePath?: string;
}

const TEMP_URL_BATCH_SIZE = 50;
const TEMP_URL_CACHE_TTL = 5 * 60 * 1000;
const LEGACY_IMAGE_ORIGIN = 'https://636c-cloudbase-d9ga2lft53663059b-1426048919.tcb.qcloud.la';
const LEGACY_FILE_ID_ROOT = 'cloud://cloudbase-d9ga2lft53663059b.636c-cloudbase-d9ga2lft53663059b-1426048919';
const tempFileUrlCache = new Map<string, CachedFileUrl>();
const previewFilePathCache = new Map<string, CachedFileUrl>();
const pendingFileUrlRequests = new Map<string, Promise<string>>();
const pendingPreviewFileRequests = new Map<string, Promise<string>>();

function getCloudApi() {
  const taroCloud = (Taro as typeof Taro & { cloud?: any }).cloud;
  if (taroCloud?.getTempFileURL) return taroCloud;
  return typeof wx !== 'undefined' && wx?.cloud?.getTempFileURL ? wx.cloud : null;
}

function normalizeUrls(value?: string[]) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function inferLegacyCloudFileID(imageUrl: string) {
  if (imageUrl.startsWith('cloud://')) return imageUrl;
  if (!imageUrl.startsWith(`${LEGACY_IMAGE_ORIGIN}/worker-house/`)) return '';

  const path = imageUrl
    .slice(LEGACY_IMAGE_ORIGIN.length)
    .split(/[?#]/, 1)[0]
    .replace(/^\/+/, '');
  return path ? `${LEGACY_FILE_ID_ROOT}/${path}` : '';
}

function getPostCloudFileIDs(post: Post) {
  const explicitFileIDs = normalizeUrls(post.imageFileIds).filter((item) => item.startsWith('cloud://'));
  if (explicitFileIDs.length > 0) return explicitFileIDs;

  return normalizeUrls(post.images)
    .map((imageUrl) => inferLegacyCloudFileID(imageUrl))
    .filter(Boolean);
}

function getCachedFileUrl(fileID: string) {
  const cached = tempFileUrlCache.get(fileID);
  if (!cached) return '';
  if (cached.expiresAt <= Date.now()) {
    tempFileUrlCache.delete(fileID);
    return '';
  }
  return cached.url;
}

async function requestTempFileUrlBatch(fileIDs: string[]) {
  if (process.env.TARO_ENV !== 'weapp' || fileIDs.length === 0) {
    return new Map<string, string>();
  }

  initCloud();
  const cloudApi = getCloudApi();
  if (!cloudApi) return new Map<string, string>();

  const response = await cloudApi.getTempFileURL({ fileList: fileIDs });
  const results = Array.isArray(response?.fileList) ? response.fileList as TempFileResult[] : [];
  const resolved = new Map<string, string>();

  results.forEach((item, index) => {
    const fileID = String(item.fileID || fileIDs[index] || '').trim();
    const url = String(item.tempFileURL || '').trim();
    if (!fileID || !url || (typeof item.status === 'number' && item.status !== 0)) return;
    tempFileUrlCache.set(fileID, {
      expiresAt: Date.now() + TEMP_URL_CACHE_TTL,
      url,
    });
    resolved.set(fileID, url);
  });

  return resolved;
}

async function resolveCloudFileUrls(fileIDs: string[]) {
  const normalizedFileIDs = Array.from(new Set(
    normalizeUrls(fileIDs).filter((item) => item.startsWith('cloud://')),
  ));
  const resolved = new Map<string, string>();
  const missing: string[] = [];

  normalizedFileIDs.forEach((fileID) => {
    const cached = getCachedFileUrl(fileID);
    if (cached) resolved.set(fileID, cached);
    else missing.push(fileID);
  });

  const missingToRequest = missing.filter((fileID) => !pendingFileUrlRequests.has(fileID));
  for (let index = 0; index < missingToRequest.length; index += TEMP_URL_BATCH_SIZE) {
    const batch = missingToRequest.slice(index, index + TEMP_URL_BATCH_SIZE);
    const batchPromise = requestTempFileUrlBatch(batch).catch((error) => {
      console.warn('[post-images] refresh temp urls failed', error);
      return new Map<string, string>();
    });

    batch.forEach((fileID) => {
      const request = batchPromise
        .then((batchResult) => batchResult.get(fileID) || '')
        .finally(() => pendingFileUrlRequests.delete(fileID));
      pendingFileUrlRequests.set(fileID, request);
    });
  }

  await Promise.all(normalizedFileIDs.map(async (fileID) => {
    if (resolved.has(fileID)) return;
    const url = await pendingFileUrlRequests.get(fileID);
    if (url) resolved.set(fileID, url);
  }));

  return resolved;
}

async function downloadPreviewFile(fileID: string) {
  if (process.env.TARO_ENV !== 'weapp') return '';

  const cached = previewFilePathCache.get(fileID);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  if (cached) previewFilePathCache.delete(fileID);

  const pending = pendingPreviewFileRequests.get(fileID);
  if (pending) return pending;

  initCloud();
  const cloudApi = getCloudApi();
  if (!cloudApi?.downloadFile) return '';

  const request = (cloudApi.downloadFile({ fileID }) as Promise<DownloadFileResult>)
    .then((result) => {
      const tempFilePath = String(result?.tempFilePath || '').trim();
      if (tempFilePath) {
        previewFilePathCache.set(fileID, {
          expiresAt: Date.now() + TEMP_URL_CACHE_TTL,
          url: tempFilePath,
        });
      }
      return tempFilePath;
    })
    .catch((error) => {
      console.warn('[post-images] download preview file failed', error);
      return '';
    })
    .finally(() => pendingPreviewFileRequests.delete(fileID));

  pendingPreviewFileRequests.set(fileID, request);
  return request;
}

async function resolvePreviewUrls(post: Post, resolvedUrls: string[]) {
  const fileIDs = getPostCloudFileIDs(post);
  if (fileIDs.length === 0 || process.env.TARO_ENV !== 'weapp') return resolvedUrls;

  const localPaths = await Promise.all(fileIDs.map((fileID) => downloadPreviewFile(fileID)));
  return resolvedUrls.map((url, index) => localPaths[index] || url);
}

function applyResolvedPostImageUrls(post: Post, resolvedFileUrls: Map<string, string>) {
  const fileIDs = getPostCloudFileIDs(post);
  if (fileIDs.length === 0) return post;

  const originalImages = normalizeUrls(post.images);
  const trackedImages = fileIDs.map((fileID, index) => resolvedFileUrls.get(fileID) || originalImages[index] || '');
  const images = [...trackedImages, ...originalImages.slice(fileIDs.length)].filter(Boolean);

  return images.length > 0 ? { ...post, imageFileIds: fileIDs, images } : post;
}

export async function resolvePostImageUrls(post: Post): Promise<Post> {
  const resolvedFileUrls = await resolveCloudFileUrls(getPostCloudFileIDs(post));
  return applyResolvedPostImageUrls(post, resolvedFileUrls);
}

export async function resolvePostListImageUrls(posts: Post[]) {
  const fileIDs = posts.flatMap((post) => getPostCloudFileIDs(post));
  const resolvedFileUrls = await resolveCloudFileUrls(fileIDs);
  return posts.map((post) => applyResolvedPostImageUrls(post, resolvedFileUrls));
}

export async function resolvePostDisplayImageUrls(post: Post): Promise<Post> {
  const resolvedPost = await resolvePostImageUrls(post);
  const resolvedUrls = normalizeUrls(resolvedPost.images);
  const displayUrls = await resolvePreviewUrls(resolvedPost, resolvedUrls);

  return displayUrls.length > 0 ? { ...resolvedPost, images: displayUrls } : resolvedPost;
}

export async function previewPostImage(post: Post, imageIndex: number) {
  let isLoading = false;
  try {
    if (process.env.TARO_ENV === 'weapp' && getPostCloudFileIDs(post).length > 0) {
      Taro.showLoading({ title: '加载图片中', mask: true });
      isLoading = true;
    }

    const resolvedPost = await resolvePostDisplayImageUrls(post);
    const urls = normalizeUrls(resolvedPost.images);
    if (urls.length === 0) throw new Error('留言图片地址为空');
    const current = urls[Math.min(Math.max(imageIndex, 0), urls.length - 1)];
    if (isLoading) {
      Taro.hideLoading();
      isLoading = false;
    }
    await Taro.previewImage({ current, urls });
  } catch (error) {
    console.warn('[post-images] preview failed', error);
    Taro.showToast({ title: '图片加载失败，请稍后重试', icon: 'none' });
  } finally {
    if (isLoading) Taro.hideLoading();
  }
}
