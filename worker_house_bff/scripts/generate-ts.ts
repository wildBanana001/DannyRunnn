import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const batchDir = path.join(__dirname, 'wechat-article-archive/batch-2026-04-26');
const indexJsonPath = path.join(batchDir, 'index.json');
const outputPath = path.resolve(__dirname, '../../worker_house/src/data/past-activities-generated.ts');

async function generateTS() {
  const indexData = JSON.parse(await readFile(indexJsonPath, 'utf8'));
  
  let tsContent = `// 自动生成 - 来源：公众号 WorkerParty 23 篇推文
// 生成时间：2026-04-26
// 可被主动合并到 activities.ts 的历史活动数组里
import type { Activity } from './activities';

export const pastActivitiesFromBatch20260426: Activity[] = [\n`;

  for (const article of indexData) {
    const indexStr = article.index.toString().padStart(2, '0');
    const articleDirName = `${indexStr}-${article.slug}`;
    const metaPath = path.join(batchDir, 'articles', articleDirName, 'meta.json');
    
    if (!existsSync(metaPath)) continue;

    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    
    const id = `past-${meta.publishDateOnly.replace(/-/g, '')}-${article.slug}`;
    const title = meta.activityHint?.titleForMiniProgram || meta.title;
    const date = meta.activityHint?.guessedDate || meta.publishDateOnly;
    const location = meta.activityHint?.guessedLocation || '深圳南山大新 社畜快乐屋';
    
    const images = meta.images || [];
    const cloudUrls = images.map((img: any) => img.cloudbaseUrl).filter(Boolean);
    const cover = cloudUrls.length > 0 ? cloudUrls[0] : '';
    
    // We try to provide the required fields for Activity
    // Looking at the Activity interface, many are required:
    // id, title, description, fullDescription, coverImage, gallery, startDate, endDate, startTime, endTime,
    // location, address, price, maxParticipants, currentParticipants, status, category, tags,
    // hostId, hostName, hostAvatar, hostDescription, venueName, venueDescription, venueImages,
    // requirements, includes, refundPolicy, createdAt, updatedAt

    const description = (meta.summary || '').substring(0, 100);
    const fullDescription = meta.summary || '';
    const sourceUrl = meta.url;
    
    tsContent += `  {
    id: '${id}',
    _id: '${id}',
    title: ${JSON.stringify(title)},
    description: ${JSON.stringify(description + " — 原文：" + sourceUrl)},
    fullDescription: ${JSON.stringify(fullDescription)},
    coverImage: '${cover}',
    cover: '${cover}',
    gallery: ${JSON.stringify(cloudUrls.slice(1))},
    covers: ${JSON.stringify(cloudUrls)},
    startDate: '${date}',
    endDate: '${date}',
    startTime: '19:30', // Mock default
    endTime: '22:30', // Mock default
    location: ${JSON.stringify(location)},
    address: ${JSON.stringify(location)},
    price: 0,
    maxParticipants: 20,
    currentParticipants: 20,
    status: 'ended',
    category: ${JSON.stringify(meta.activityHint?.activityType || '活动')},
    tags: ['历史活动'],
    hostId: 'host-orange',
    hostName: '橙子',
    hostAvatar: '',
    hostDescription: '',
    venueName: '社畜快乐屋',
    venueDescription: '',
    venueImages: [],
    requirements: [],
    includes: [],
    refundPolicy: '',
    createdAt: '${meta.publishTime ? meta.publishTime.replace(' ', 'T') + ':00Z' : '2026-04-26T00:00:00Z'}',
    updatedAt: '${meta.publishTime ? meta.publishTime.replace(' ', 'T') + ':00Z' : '2026-04-26T00:00:00Z'}',
    enabled: true,
  },\n`;
  }

  tsContent += `];\n`;

  await writeFile(outputPath, tsContent, 'utf8');
  console.log(`Generated ${outputPath}`);
}

generateTS().catch(console.error);