import { getApiMode, request } from './request';

export interface SiteConfigRecord {
  communityQrcode: string;
  contactWechat: string;
  heroSlogan: string;
  heroTitle: string;
  aboutUs: string;
  updatedAt: string;
  updatedBy: string;
}

export const defaultSiteConfigRecord: SiteConfigRecord = {
  communityQrcode: '',
  contactWechat: 'DannyRunnn',
  heroSlogan: '真实聚点',
  heroTitle: '社畜空间',
  aboutUs: '一间社畜快乐屋，把每次相遇都变成松弛体验。',
  updatedAt: '',
  updatedBy: '',
};

function normalizeSiteConfigRecord(record?: Partial<SiteConfigRecord> | null): SiteConfigRecord {
  return {
    communityQrcode: typeof record?.communityQrcode === 'string' ? record.communityQrcode : defaultSiteConfigRecord.communityQrcode,
    contactWechat: typeof record?.contactWechat === 'string' && record.contactWechat.trim()
      ? record.contactWechat.trim()
      : defaultSiteConfigRecord.contactWechat,
    heroSlogan: typeof record?.heroSlogan === 'string' && record.heroSlogan.trim()
      ? record.heroSlogan.trim()
      : defaultSiteConfigRecord.heroSlogan,
    heroTitle: typeof record?.heroTitle === 'string' && record.heroTitle.trim()
      ? record.heroTitle.trim()
      : defaultSiteConfigRecord.heroTitle,
    aboutUs: typeof record?.aboutUs === 'string' && record.aboutUs.trim()
      ? record.aboutUs.trim()
      : defaultSiteConfigRecord.aboutUs,
    updatedAt: typeof record?.updatedAt === 'string' ? record.updatedAt : defaultSiteConfigRecord.updatedAt,
    updatedBy: typeof record?.updatedBy === 'string' ? record.updatedBy : defaultSiteConfigRecord.updatedBy,
  };
}

export async function fetchCommunitySiteConfig(): Promise<SiteConfigRecord> {
  if (getApiMode() === 'mock') {
    return defaultSiteConfigRecord;
  }

  try {
    const result = await request<SiteConfigRecord>({
      path: '/api/site-config',
    });
    return normalizeSiteConfigRecord(result);
  } catch {
    return defaultSiteConfigRecord;
  }
}

export async function updateCommunitySiteConfig(payload: Partial<Pick<SiteConfigRecord, 'aboutUs' | 'communityQrcode' | 'contactWechat' | 'heroSlogan' | 'heroTitle'>>) {
  const result = await request<SiteConfigRecord>({
    data: payload,
    method: 'PUT',
    path: '/api/admin-mini/site-config',
  });
  return normalizeSiteConfigRecord(result);
}
