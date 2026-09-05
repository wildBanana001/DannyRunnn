export interface AdminMiniPosterRecord {
  id: string;
  title: string;
  coverImage: string;
  detailImages: string[];
  enabled: boolean;
  linkUrl: string;
  relatedActivityId: string;
  status: 'online' | 'offline';
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export class PosterPayloadValidationError extends Error {
  readonly code = 'POSTER_PAYLOAD_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'PosterPayloadValidationError';
  }
}

export function isPosterPayloadValidationError(error: unknown): boolean {
  if (error instanceof PosterPayloadValidationError) return true;
  if (!error || typeof error !== 'object') return false;
  const input = error as { code?: unknown; name?: unknown };
  return input.code === 'POSTER_PAYLOAD_INVALID'
    || input.name === 'PosterPayloadValidationError';
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasOwn(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function normalizePosterImageList(value: unknown, strict: boolean) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    if (strict) throw new PosterPayloadValidationError('海报详情图片必须是字符串数组');
    return [];
  }
  const images: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) {
      if (strict) throw new PosterPayloadValidationError('海报详情图片必须是非空字符串');
      continue;
    }
    images.push(item.trim());
  }
  return images;
}

export function validatePosterEnabledInput(input: Record<string, unknown>, required: boolean) {
  const provided = hasOwn(input, 'enabled');
  if ((required || provided) && typeof input.enabled !== 'boolean') {
    throw new PosterPayloadValidationError('enabled 必须显式传入布尔值');
  }
  return provided ? input.enabled as boolean : undefined;
}

export function normalizeAdminMiniPoster(record: Record<string, unknown>): AdminMiniPosterRecord {
  const coverImage = sanitizeString(record.coverImage)
    || (Array.isArray(record.detailImages) ? sanitizeString(record.detailImages[0]) : '');
  const rawStatus = sanitizeString(record.status);
  const statusIsValidOrAbsent = !hasOwn(record, 'status')
    || rawStatus === 'online'
    || rawStatus === 'offline';
  // A read is online only with an explicit boolean true. Missing, stringified or
  // contradictory values remain offline so corrupted legacy data is never exposed.
  const enabled = record.enabled === true
    && statusIsValidOrAbsent
    && rawStatus !== 'offline';
  const detailImages = normalizePosterImageList(record.detailImages, false)
    ?? (coverImage ? [coverImage] : []);
  const createdAt = String(record.createdAt ?? new Date().toISOString());

  return {
    id: String(record.id ?? record._id ?? ''),
    title: String(record.title ?? ''),
    coverImage,
    detailImages: detailImages.length ? detailImages : coverImage ? [coverImage] : [],
    enabled,
    linkUrl: sanitizeString(record.linkUrl),
    relatedActivityId: sanitizeString(record.relatedActivityId),
    status: enabled ? 'online' : 'offline',
    sort: Number(record.sort ?? 0),
    createdAt,
    updatedAt: String(record.updatedAt ?? createdAt),
  };
}

export function buildPosterPayload(
  input: Record<string, unknown>,
  current?: AdminMiniPosterRecord,
) {
  const inputEnabled = validatePosterEnabledInput(input, !current);
  const hasStatus = hasOwn(input, 'status');
  const inputStatus = hasStatus ? sanitizeString(input.status) : '';
  if (hasStatus && inputStatus !== 'online' && inputStatus !== 'offline') {
    throw new PosterPayloadValidationError('status 只能是 online 或 offline');
  }
  if (
    inputEnabled !== undefined
    && hasStatus
    && inputEnabled !== (inputStatus === 'online')
  ) {
    throw new PosterPayloadValidationError('enabled 与 status 状态不一致');
  }

  const enabled = inputEnabled ?? (hasStatus ? inputStatus === 'online' : current?.enabled);
  if (typeof enabled !== 'boolean') {
    throw new PosterPayloadValidationError('enabled 必须显式传入布尔值');
  }
  const coverImage = sanitizeString(input.coverImage) || current?.coverImage || '';
  const inputDetailImages = normalizePosterImageList(input.detailImages, hasOwn(input, 'detailImages'));
  const detailImages = inputDetailImages ?? current?.detailImages ?? [];

  return {
    title: sanitizeString(input.title) || current?.title || '',
    coverImage,
    detailImages: detailImages.length ? detailImages : coverImage ? [coverImage] : [],
    enabled,
    linkUrl: sanitizeString(input.linkUrl) || current?.linkUrl || '',
    relatedActivityId: sanitizeString(input.relatedActivityId) || current?.relatedActivityId || '',
    status: enabled ? 'online' as const : 'offline' as const,
    sort: Number(input.sort ?? current?.sort ?? 0),
  };
}

export function isPublicPoster(record: { enabled?: unknown } | null | undefined) {
  return record?.enabled === true;
}
