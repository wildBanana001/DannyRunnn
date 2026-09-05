import { getMockSiteConfigRecord } from '@/data/mock-member';
import type { HomeOwnerCard, SiteConfigRecord } from '@/types/siteConfig';
import { getApiMode, requestWithMode } from './request';

export type { HomeOwnerCard, SiteConfigRecord } from '@/types/siteConfig';

export const emptySiteConfigRecord: SiteConfigRecord = {
  communityWallEnabled: false,
  communityQrcode: '',
  contactWechat: '',
  heroSlogan: '',
  heroTitle: '',
  aboutUs: '',
  homeCopyLead: '',
  homeCopyBody: '',
  homeChannelsFinder: '',
  homeOfficialAccountId: '',
  homeOfficialAccountName: '',
  homeSpaceImages: [],
  homeOwners: [],
  updatedAt: '',
  updatedBy: '',
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function normalizeOwnerCards(value: unknown): HomeOwnerCard[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const raw = item as Record<string, unknown>;
      const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `owner-${index}`;
      const avatar = typeof raw.avatar === 'string' ? raw.avatar : '';
      const label = typeof raw.label === 'string' ? raw.label : '';
      const description = typeof raw.description === 'string' ? raw.description : '';
      if (!label && !description && !avatar) {
        return null;
      }
      return { id, avatar, label, description } satisfies HomeOwnerCard;
    })
    .filter((item): item is HomeOwnerCard => item !== null);
}

function normalizeSiteConfigRecord(record?: Partial<SiteConfigRecord> | null): SiteConfigRecord {
  const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  return {
    communityWallEnabled: record?.communityWallEnabled === true,
    communityQrcode: normalizeString(record?.communityQrcode),
    contactWechat: normalizeString(record?.contactWechat),
    heroSlogan: normalizeString(record?.heroSlogan),
    heroTitle: normalizeString(record?.heroTitle),
    aboutUs: normalizeString(record?.aboutUs),
    homeCopyLead: normalizeString(record?.homeCopyLead),
    homeCopyBody: normalizeString(record?.homeCopyBody),
    homeChannelsFinder: normalizeString(record?.homeChannelsFinder),
    homeOfficialAccountId: normalizeString(record?.homeOfficialAccountId),
    homeOfficialAccountName: normalizeString(record?.homeOfficialAccountName),
    homeSpaceImages: normalizeStringArray(record?.homeSpaceImages),
    homeOwners: normalizeOwnerCards(record?.homeOwners),
    updatedAt: normalizeString(record?.updatedAt),
    updatedBy: normalizeString(record?.updatedBy),
  };
}

export async function fetchCommunitySiteConfig(): Promise<SiteConfigRecord> {
  const apiMode = getApiMode();
  if (apiMode === 'mock') {
    return getMockSiteConfigRecord();
  }

  const result = await requestWithMode<SiteConfigRecord>(apiMode, {
    path: '/api/site-config',
  });
  return normalizeSiteConfigRecord(result);
}
