import { getApiMode, request } from './request';

export interface HomeOwnerCard {
  id: string;
  avatar: string;
  label: string;
  description: string;
}

export interface SiteConfigRecord {
  communityQrcode: string;
  contactWechat: string;
  heroSlogan: string;
  heroTitle: string;
  aboutUs: string;
  homeCopyLead: string;
  homeCopyBody: string;
  homeChannelsFinder: string;
  homeOfficialAccountId: string;
  homeOfficialAccountName: string;
  homeSpaceImages: string[];
  homeOwners: HomeOwnerCard[];
  updatedAt: string;
  updatedBy: string;
}

const defaultHomeOwners: HomeOwnerCard[] = [
  {
    id: 'owner-orange',
    avatar: '',
    label: '橙子',
    description: '互联网大厂裸辞，正在探索新新人类生活方式，徒手爆改80m²社畜快乐屋，旅游狂热分子，enfj理想主义体验派！',
  },
  {
    id: 'owner-cat',
    avatar: '',
    label: '小黑',
    description: '一只3岁的粘人奶牛猫，社畜团宠，一脸正义又娇憨可爱的黑猫警长，yes sir~',
  },
];

export const defaultSiteConfigRecord: SiteConfigRecord = {
  communityQrcode: '',
  contactWechat: 'DannyRunnn',
  heroSlogan: '真实聚点',
  heroTitle: '社畜空间',
  aboutUs: '一间社畜快乐屋，把每次相遇都变成松弛体验。',
  homeCopyLead: 'Hiiii这里是社畜没有派对！',
  homeCopyBody: '一个通过客厅建立有趣新人类社交方式的城市共居空间，这里为社交、文化、艺术、共创、女性友好住宿等一切创意活动无限开放',
  homeChannelsFinder: 'sph_worker_house_demo',
  homeOfficialAccountId: 'gh_worker_house_official',
  homeOfficialAccountName: '社畜没有派对',
  homeSpaceImages: [],
  homeOwners: defaultHomeOwners,
  updatedAt: '',
  updatedBy: '',
};

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const list = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return list.length > 0 ? list : [...fallback];
}

function normalizeOwnerCards(value: unknown, fallback: HomeOwnerCard[]): HomeOwnerCard[] {
  if (!Array.isArray(value)) {
    return fallback.map((item) => ({ ...item }));
  }
  const list = value
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
  return list.length > 0 ? list : fallback.map((item) => ({ ...item }));
}

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
    homeCopyLead: typeof record?.homeCopyLead === 'string' && record.homeCopyLead.trim()
      ? record.homeCopyLead.trim()
      : defaultSiteConfigRecord.homeCopyLead,
    homeCopyBody: typeof record?.homeCopyBody === 'string' && record.homeCopyBody.trim()
      ? record.homeCopyBody.trim()
      : defaultSiteConfigRecord.homeCopyBody,
    homeChannelsFinder: typeof record?.homeChannelsFinder === 'string' && record.homeChannelsFinder.trim()
      ? record.homeChannelsFinder.trim()
      : defaultSiteConfigRecord.homeChannelsFinder,
    homeOfficialAccountId: typeof record?.homeOfficialAccountId === 'string' && record.homeOfficialAccountId.trim()
      ? record.homeOfficialAccountId.trim()
      : defaultSiteConfigRecord.homeOfficialAccountId,
    homeOfficialAccountName: typeof record?.homeOfficialAccountName === 'string' && record.homeOfficialAccountName.trim()
      ? record.homeOfficialAccountName.trim()
      : defaultSiteConfigRecord.homeOfficialAccountName,
    homeSpaceImages: normalizeStringArray(record?.homeSpaceImages, defaultSiteConfigRecord.homeSpaceImages),
    homeOwners: normalizeOwnerCards(record?.homeOwners, defaultSiteConfigRecord.homeOwners),
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

export type SiteConfigUpdatePayload = Partial<Pick<SiteConfigRecord,
  | 'aboutUs'
  | 'communityQrcode'
  | 'contactWechat'
  | 'heroSlogan'
  | 'heroTitle'
  | 'homeCopyLead'
  | 'homeCopyBody'
  | 'homeChannelsFinder'
  | 'homeOfficialAccountId'
  | 'homeOfficialAccountName'
  | 'homeSpaceImages'
  | 'homeOwners'
>>;

export async function updateCommunitySiteConfig(payload: SiteConfigUpdatePayload) {
  const result = await request<SiteConfigRecord>({
    data: payload,
    method: 'PUT',
    path: '/api/admin-mini/site-config',
  });
  return normalizeSiteConfigRecord(result);
}
