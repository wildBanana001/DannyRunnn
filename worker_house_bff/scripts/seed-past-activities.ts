import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ActivityRecord } from '../src/types/index.js';
import { listActivities, upsertActivity } from '../src/data/activities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const seedFilePath = path.resolve(
  workspaceRoot,
  'worker_house',
  'src',
  'data',
  'past-activities-generated.ts',
);

const RESERVED_ONGOING_IDS = new Set<string>([
  'act-001',
  'act-002',
  'act-003',
  'act-004',
  'act-005',
  'act-006',
  'act-007',
]);

type SeedActivity = {
  id?: string;
  _id?: string;
  title?: string;
  description?: string;
  fullDescription?: string;
  cover?: string;
  coverImage?: string;
  gallery?: string[];
  covers?: string[];
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  address?: string;
  price?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  status?: string;
  category?: string;
  tags?: string[];
  hostId?: string;
  hostName?: string;
  hostAvatar?: string;
  hostDescription?: string;
  venueName?: string;
  venueDescription?: string;
  venueImages?: string[];
  requirements?: string[];
  includes?: string[];
  refundPolicy?: string;
  createdAt?: string;
  updatedAt?: string;
  enabled?: boolean;
};

async function loadSeedActivities(): Promise<SeedActivity[]> {
  const seedModule = await import(pathToFileURL(seedFilePath).href);
  const seeds = (seedModule as any).pastActivitiesFromBatch20260426 as SeedActivity[] | undefined;
  if (!Array.isArray(seeds)) {
    throw new Error('无法从 past-activities-generated.ts 读取种子数据数组 pastActivitiesFromBatch20260426');
  }
  return seeds;
}

function buildSeedId(seed: SeedActivity): string {
  const rawId = seed.id || seed._id;
  if (!rawId) {
    throw new Error('种子数据缺少 id/_id 字段，无法生成稳定主键');
  }
  return String(rawId);
}

function mapSeedToActivityInput(seed: SeedActivity, id: string): Partial<ActivityRecord> & { _id: string } {
  const base: any = {
    ...seed,
    id,
    _id: id,
    status: 'ended',
  };

  return base;
}

async function seedPastActivities() {
  console.log('[seed-past-activities] 开始执行');

  const seeds = await loadSeedActivities();
  const existingList = listActivities();
  const existingById = new Map(existingList.map((item) => [item.id, item]));

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const seed of seeds) {
    const id = buildSeedId(seed);

    if (RESERVED_ONGOING_IDS.has(id)) {
      skippedCount += 1;
      console.log(`[skip] 保留活动，不做修改：id=${id}`);
      continue;
    }

    const titlePreview = (seed.title ?? '').slice(0, 20);
    const hasExisting = existingById.has(id);

    const input = mapSeedToActivityInput(seed, id);
    const action = hasExisting ? 'update' : 'insert';

    upsertActivity(id, input as any);

    if (hasExisting) {
      updatedCount += 1;
    } else {
      insertedCount += 1;
    }

    console.log(
      `[${action}] id=${id}, _id=${id}, title=${titlePreview || '（无标题）'}`,
    );
  }

  const finalList = listActivities();
  const totalCount = finalList.length;
  const endedCount = finalList.filter((item) => item.status === 'ended').length;
  const ongoingCount = finalList.filter((item) => item.status === 'ongoing').length;

  console.log(
    `[summary] insert=${insertedCount}, update=${updatedCount}, skip=${skippedCount}, total=${totalCount}, ongoing=${ongoingCount}, ended=${endedCount}`,
  );
  console.log('[seed-past-activities] 执行完成');
}

seedPastActivities().catch((error) => {
  console.error('[seed-past-activities] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
