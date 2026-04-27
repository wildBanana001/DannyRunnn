import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uploadToWechatCloudStorage } from '../src/wechatStorage.js';

interface MigrationEntry {
  fileID: string;
  url: string;
}

type MigrationResult = Record<string, MigrationEntry>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const legacySourceDir = path.resolve(workspaceRoot, 'worker_house', 'src', 'assets', 'wechat-article');
const archiveSourceDir = path.resolve(workspaceRoot, 'worker_house', 'scripts', 'wechat-article-archive');
const resultFilePath = path.resolve(__dirname, 'migration-result.json');

function getSourceDir() {
  if (existsSync(legacySourceDir)) {
    return legacySourceDir;
  }

  return archiveSourceDir;
}

async function readMigrationResult(): Promise<MigrationResult> {
  if (!existsSync(resultFilePath)) {
    return {};
  }

  const raw = await readFile(resultFilePath, 'utf8');
  return raw.trim() ? (JSON.parse(raw) as MigrationResult) : {};
}

async function persistResult(result: MigrationResult) {
  await mkdir(path.dirname(resultFilePath), { recursive: true });
  await writeFile(resultFilePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function buildWechatArticleCloudPath(fileName: string) {
  return `worker-house/wechat-article/${fileName}`;
}

async function listImages(sourceDir: string) {
  const names = await readdir(sourceDir);
  return names.filter((name) => /^img-\d{2}\.jpg$/i.test(name)).sort();
}

async function migrate() {
  const sourceDir = getSourceDir();
  if (!existsSync(sourceDir)) {
    throw new Error(`未找到素材目录：${sourceDir}`);
  }

  const images = await listImages(sourceDir);
  if (images.length === 0) {
    throw new Error(`素材目录中未找到 img-xx.jpg：${sourceDir}`);
  }

  const result = await readMigrationResult();
  let uploadedCount = 0;

  for (const fileName of images) {
    if (result[fileName]?.fileID && result[fileName]?.url) {
      console.log(`[skip] ${fileName} 已存在上传结果`);
      continue;
    }

    const filePath = path.join(sourceDir, fileName);
    const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    console.log(`[upload] ${fileName} (${Math.round(fileStat.size / 1024)}KB)`);

    const uploadResult = await uploadToWechatCloudStorage(
      {
        buffer,
        contentType: 'image/jpeg',
        fileName,
        size: fileStat.size,
      },
      buildWechatArticleCloudPath(fileName),
    );

    result[fileName] = {
      fileID: uploadResult.fileID,
      url: uploadResult.url,
    };
    uploadedCount += 1;
    await persistResult(result);
    console.log(`[done] ${fileName} -> ${uploadResult.url}`);
  }

  console.log(`迁移完成：共 ${images.length} 张，新增上传 ${uploadedCount} 张，结果文件：${resultFilePath}`);
}

migrate().catch((error) => {
  console.error('[migrate-images] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
