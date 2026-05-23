import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'siteConfig.store.json');
const defaultAboutUs = '深圳南山大新站 D 口附近的一间 80m² 社畜快乐屋，沙发客厅、投影角、手作桌和留言墙把每次相遇都变成像回家一样的松弛体验。';
const defaultHomeCopyLead = 'Hiiii这里是社畜没有派对！';
const defaultHomeCopyBody = '一个通过客厅建立有趣新人类社交方式的城市共居空间，这里为社交、文化、艺术、共创、女性友好住宿等一切创意活动无限开放';
const defaultHomeChannelsFinder = 'sph_worker_house_demo';
const defaultHomeOfficialAccountId = 'gh_worker_house_official';
const defaultHomeOfficialAccountName = '社畜没有派对';
const defaultHomeSpaceImage = '/static/images/home/space-livingroom.jpg';
const defaultHomeOwners = [
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
const defaultRecord = {
    communityQrcode: '',
    contactWechat: 'DannyRunnn',
    heroSlogan: '社畜空间 · 真实聚点',
    heroTitle: '社畜没有派对',
    aboutUs: defaultAboutUs,
    homeCopyLead: defaultHomeCopyLead,
    homeCopyBody: defaultHomeCopyBody,
    homeChannelsFinder: defaultHomeChannelsFinder,
    homeOfficialAccountId: defaultHomeOfficialAccountId,
    homeOfficialAccountName: defaultHomeOfficialAccountName,
    homeSpaceImages: [defaultHomeSpaceImage],
    homeOwners: defaultHomeOwners,
    updatedAt: '',
    updatedBy: '',
};
const siteConfigStore = {
    record: null,
};
function now() {
    return new Date().toISOString();
}
function clone(value) {
    return structuredClone(value);
}
function sanitizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizeStringArray(value, fallback) {
    if (!Array.isArray(value)) {
        return [...fallback];
    }
    const list = value
        .map((item) => sanitizeString(item))
        .filter((item) => item.length > 0);
    return list.length > 0 ? list : [...fallback];
}
function normalizeOwnerCards(value, fallback) {
    if (!Array.isArray(value)) {
        return clone(fallback);
    }
    const list = value
        .map((item, index) => {
        if (!item || typeof item !== 'object') {
            return null;
        }
        const raw = item;
        const id = sanitizeString(raw.id) || `owner-${Date.now()}-${index}`;
        const avatar = sanitizeString(raw.avatar);
        const label = sanitizeString(raw.label);
        const description = sanitizeString(raw.description);
        if (!label && !description && !avatar) {
            return null;
        }
        return { id, avatar, label, description };
    })
        .filter((item) => item !== null);
    return list.length > 0 ? list : clone(fallback);
}
function normalizeRecord(record) {
    return {
        communityQrcode: sanitizeString(record?.communityQrcode) || '',
        contactWechat: sanitizeString(record?.contactWechat) || defaultRecord.contactWechat,
        heroSlogan: sanitizeString(record?.heroSlogan) || defaultRecord.heroSlogan,
        heroTitle: sanitizeString(record?.heroTitle) || defaultRecord.heroTitle,
        aboutUs: sanitizeString(record?.aboutUs) || defaultRecord.aboutUs,
        homeCopyLead: sanitizeString(record?.homeCopyLead) || defaultRecord.homeCopyLead,
        homeCopyBody: sanitizeString(record?.homeCopyBody) || defaultRecord.homeCopyBody,
        homeChannelsFinder: sanitizeString(record?.homeChannelsFinder) || defaultRecord.homeChannelsFinder,
        homeOfficialAccountId: sanitizeString(record?.homeOfficialAccountId) || defaultRecord.homeOfficialAccountId,
        homeOfficialAccountName: sanitizeString(record?.homeOfficialAccountName) || defaultRecord.homeOfficialAccountName,
        homeSpaceImages: normalizeStringArray(record?.homeSpaceImages, defaultRecord.homeSpaceImages),
        homeOwners: normalizeOwnerCards(record?.homeOwners, defaultRecord.homeOwners),
        updatedAt: sanitizeString(record?.updatedAt) || defaultRecord.updatedAt,
        updatedBy: sanitizeString(record?.updatedBy) || defaultRecord.updatedBy,
    };
}
function loadSiteConfig() {
    if (siteConfigStore.record) {
        return;
    }
    if (!existsSync(storageFilePath)) {
        siteConfigStore.record = normalizeRecord(defaultRecord);
        persistSiteConfig();
        return;
    }
    try {
        const rawContent = readFileSync(storageFilePath, 'utf-8');
        const parsed = JSON.parse(rawContent);
        siteConfigStore.record = normalizeRecord(parsed);
    }
    catch {
        siteConfigStore.record = normalizeRecord(defaultRecord);
        persistSiteConfig();
    }
}
function persistSiteConfig() {
    mkdirSync(path.dirname(storageFilePath), { recursive: true });
    writeFileSync(storageFilePath, JSON.stringify(siteConfigStore.record, null, 2), 'utf-8');
}
export function getSiteConfig() {
    loadSiteConfig();
    return clone(siteConfigStore.record ?? normalizeRecord(defaultRecord));
}
export function updateSiteConfig(input, updatedBy) {
    loadSiteConfig();
    const timestamp = now();
    const current = siteConfigStore.record ?? normalizeRecord(defaultRecord);
    const nextRecord = normalizeRecord({
        ...current,
        ...input,
        updatedAt: timestamp,
        updatedBy: sanitizeString(updatedBy) || current.updatedBy,
    });
    siteConfigStore.record = nextRecord;
    persistSiteConfig();
    return clone(nextRecord);
}
