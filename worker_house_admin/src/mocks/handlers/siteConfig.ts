import { http, HttpResponse } from 'msw';
import { getSiteConfigRecord, updateSiteConfigRecord } from '@/mocks/db/siteConfig';
import type { SiteConfig } from '@/types/site';

export const siteConfigHandlers = [
  http.get('/api/site/config', () => {
    const config = getSiteConfigRecord();
    return HttpResponse.json(config);
  }),
  http.put('/api/site/config', async ({ request }) => {
    const payload = (await request.json()) as SiteConfig;
    const updated = updateSiteConfigRecord(payload);
    return HttpResponse.json(updated);
  }),
];
