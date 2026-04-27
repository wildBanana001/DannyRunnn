import type { Request } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import { buildCloudStoragePath, uploadToWechatCloudStorage } from '../wechatStorage.js';

interface Base64UploadPayload {
  base64?: string;
  contentType?: string;
  fileName?: string;
  name?: string;
}

interface BatchUploadItem extends Base64UploadPayload {
  path?: string;
}

interface BatchUploadSource {
  cloudPath: string;
  buffer: Buffer;
  contentType?: string;
  fileName: string;
  size: number;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 10,
  },
});

export const adminUploadRouter = Router();
export const userUploadRouter = Router();

adminUploadRouter.use(authMiddleware);

function getBase64Body(request: Request) {
  const body = request.body as Base64UploadPayload | undefined;
  const value = body?.base64?.trim();
  if (!value) {
    return null;
  }

  const dataUrlMatch = value.match(/^data:(.+?);base64,(.+)$/);
  const contentType = body?.contentType?.trim() || dataUrlMatch?.[1];
  const base64 = dataUrlMatch?.[2] ?? value;

  return {
    buffer: Buffer.from(base64, 'base64'),
    contentType,
    fileName: body?.fileName?.trim() || body?.name?.trim() || 'upload.jpg',
  };
}

export function toSingleUploadSource(request: Request) {
  if (request.file) {
    return {
      buffer: request.file.buffer,
      contentType: request.file.mimetype,
      fileName: request.file.originalname || 'upload.jpg',
      size: request.file.size,
    };
  }

  const payload = getBase64Body(request);
  if (!payload) {
    throw new Error('请通过 multipart/form-data 传 file 字段，或传 base64 + fileName');
  }

  return {
    ...payload,
    size: payload.buffer.byteLength,
  };
}

function toBatchUploadSources(request: Request): BatchUploadSource[] {
  const files = (request.files as Express.Multer.File[] | undefined)?.map((file) => ({
    cloudPath: buildCloudStoragePath('admin/batch', file.originalname || 'upload.jpg'),
    buffer: file.buffer,
    contentType: file.mimetype,
    fileName: file.originalname || 'upload.jpg',
    size: file.size,
  }));

  if (files && files.length > 0) {
    return files;
  }

  const body = request.body as { files?: BatchUploadItem[] | string };
  const rawFiles = body?.files;
  if (!rawFiles) {
    throw new Error('请通过 files[] 上传多个文件，或传 JSON files 数组');
  }

  const parsedFiles = typeof rawFiles === 'string' ? (JSON.parse(rawFiles) as BatchUploadItem[]) : rawFiles;
  if (!Array.isArray(parsedFiles) || parsedFiles.length === 0) {
    throw new Error('files 数组不能为空');
  }

  return parsedFiles.map((item, index) => {
    const base64 = item.base64?.trim();
    if (!base64) {
      throw new Error(`第 ${index + 1} 个文件缺少 base64`);
    }

    const dataUrlMatch = base64.match(/^data:(.+?);base64,(.+)$/);
    const normalizedBase64 = dataUrlMatch?.[2] ?? base64;
    const fileName = item.fileName?.trim() || item.name?.trim() || `upload-${index + 1}.jpg`;

    return {
      cloudPath: item.path?.trim() || buildCloudStoragePath('admin/batch', fileName),
      buffer: Buffer.from(normalizedBase64, 'base64'),
      contentType: item.contentType?.trim() || dataUrlMatch?.[1],
      fileName,
      size: Buffer.byteLength(normalizedBase64, 'base64'),
    };
  });
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await task(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

adminUploadRouter.post('/', upload.single('file'), async (request, response, next) => {
  try {
    const source = toSingleUploadSource(request);
    const result = await uploadToWechatCloudStorage(source, buildCloudStoragePath('admin', source.fileName));
    response.json(result);
  } catch (error) {
    next(error);
  }
});

userUploadRouter.use(wxCloudrunAuth);

userUploadRouter.post('/', upload.single('file'), async (request, response, next) => {
  try {
    const source = toSingleUploadSource(request);
    const result = await uploadToWechatCloudStorage(source, buildCloudStoragePath('posts', source.fileName));
    response.json(result);
  } catch (error) {
    next(error);
  }
});

adminUploadRouter.post('/batch', upload.array('files', 10), async (request, response, next) => {
  try {
    const sources = toBatchUploadSources(request);
    const list = await runWithConcurrency(sources, 3, async (source) => {
      try {
        return await uploadToWechatCloudStorage(source, source.cloudPath);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : '上传失败',
          name: source.fileName,
          size: source.size,
        };
      }
    });

    response.json({ list });
  } catch (error) {
    next(error);
  }
});
