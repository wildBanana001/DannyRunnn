import request from '@/services/request';
import type { SiteConfig } from '@/types/site';

export async function getSiteConfig() {
  const { data } = await request.get<SiteConfig>('/site/config');
  return data;
}

export async function updateSiteConfig(payload: SiteConfig) {
  const { data } = await request.put<SiteConfig>('/site/config', payload);
  return data;
}
