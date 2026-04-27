import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uploadToWechatCloudStorage } from '../src/wechatStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const batchDir = path.join(__dirname, 'wechat-article-archive/batch-2026-04-26');
const indexJsonPath = path.join(batchDir, 'index.json');
const resultFilePath = path.join(batchDir, 'upload-result.json');
const failedUploadsFilePath = path.join(batchDir, 'failed-uploads.json');

async function migrateBatch() {
  const indexData = JSON.parse(await readFile(indexJsonPath, 'utf8'));

  const result = {
    batch: "2026-04-26",
    totalImages: 0,
    uploaded: 0,
    failed: 0,
    byArticle: [] as any[],
  };

  const failedUploads: any[] = [];
  
  for (const article of indexData) {
    const indexStr = article.index.toString().padStart(2, '0');
    const articleDirName = `${indexStr}-${article.slug}`;
    const articleDir = path.join(batchDir, 'articles', articleDirName);
    const metaPath = path.join(articleDir, 'meta.json');
    
    if (!existsSync(metaPath)) {
      console.warn(`[warn] meta.json missing for ${articleDirName}`);
      continue;
    }

    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    const images = meta.images || [];
    
    const articleResult = {
      index: article.index,
      slug: article.slug,
      total: images.length,
      uploaded: 0,
      failed: 0,
      images: [] as any[],
    };
    
    result.totalImages += images.length;

    // chunk promises 5 by 5
    for (let i = 0; i < images.length; i += 5) {
      const chunk = images.slice(i, i + 5);
      await Promise.all(chunk.map(async (img: any) => {
        if (img.cloudbaseUrl) {
          console.log(`[skip] ${articleDirName}/${img.localPath} already has cloudbaseUrl`);
          articleResult.uploaded++;
          articleResult.images.push({ seq: img.seq, cloudbaseUrl: img.cloudbaseUrl });
          return;
        }

        const imgPath = path.join(articleDir, img.localPath);
        if (!existsSync(imgPath)) {
          console.error(`[error] image not found: ${imgPath}`);
          articleResult.failed++;
          failedUploads.push({ path: `${articleDirName}/${img.localPath}`, reason: 'file not found' });
          return;
        }

        const buffer = await readFile(imgPath);
        const fileName = path.basename(img.localPath);
        const cloudPath = `wechat-articles/batch-2026-04-26/${articleDirName}/${fileName}`;

        let lastError;
        let success = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            console.log(`[uploading] ${cloudPath} (attempt ${attempt + 1})`);
            const uploadRes = await uploadToWechatCloudStorage(
              { buffer, fileName, size: buffer.byteLength, contentType: 'image/jpeg' },
              cloudPath
            );
            img.cloudbaseUrl = uploadRes.url;
            articleResult.uploaded++;
            articleResult.images.push({ seq: img.seq, cloudbaseUrl: img.cloudbaseUrl });
            console.log(`[done] ${cloudPath} -> ${uploadRes.url}`);
            success = true;
            break;
          } catch (err: any) {
            lastError = err;
            console.error(`[retry] ${cloudPath} failed on attempt ${attempt + 1}: ${err.message}`);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        }

        if (!success) {
          articleResult.failed++;
          failedUploads.push({ path: `${articleDirName}/${img.localPath}`, reason: lastError?.message || String(lastError) });
          console.error(`[failed] ${cloudPath}: ${lastError?.message}`);
        }
      }));
    }
    
    result.uploaded += articleResult.uploaded;
    result.failed += articleResult.failed;
    result.byArticle.push(articleResult);

    await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    await writeFile(resultFilePath, JSON.stringify(result, null, 2), 'utf8');
  }

  if (failedUploads.length > 0) {
    await writeFile(failedUploadsFilePath, JSON.stringify(failedUploads, null, 2), 'utf8');
  }

  console.log(`\n[summary] Total: ${result.totalImages}, Uploaded: ${result.uploaded}, Failed: ${result.failed}`);
}

migrateBatch().catch(console.error);