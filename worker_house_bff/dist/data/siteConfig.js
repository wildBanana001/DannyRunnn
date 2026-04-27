import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'siteConfig.store.json');
const defaultAboutUs = '深圳南山大新站 D 口附近的一间 80m² 社畜快乐屋，沙发客厅、投影角、手作桌和留言墙把每次相遇都变成像回家一样的松弛体验。';
const defaultRecord = {
    communityQrcode: '',
    contactWechat: 'DannyRunnn',
    heroSlogan: '社畜空间 · 真实聚点',
    heroTitle: '社畜没有派对',
    aboutUs: defaultAboutUs,
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
function normalizeRecord(record) {
    return {
        communityQrcode: sanitizeString(record?.communityQrcode) || '',
        contactWechat: sanitizeString(record?.contactWechat) || defaultRecord.contactWechat,
        heroSlogan: sanitizeString(record?.heroSlogan) || defaultRecord.heroSlogan,
        heroTitle: sanitizeString(record?.heroTitle) || defaultRecord.heroTitle,
        aboutUs: sanitizeString(record?.aboutUs) || defaultRecord.aboutUs,
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
