import { useEffect, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { fetchCommunitySiteConfig, defaultSiteConfigRecord, type SiteConfigRecord } from '@/services/siteConfig';
import { fetchCardPackages } from '@/services/member';
import type { CardPackage } from '@/types';

let siteConfigCache: SiteConfigRecord | null = null;
let siteConfigCacheTime = 0;
const TTL = 15 * 60 * 1000;

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfigRecord>(siteConfigCache || defaultSiteConfigRecord);

  const loadConfig = async () => {
    if (siteConfigCache && Date.now() - siteConfigCacheTime < TTL) {
      setConfig(siteConfigCache);
      return;
    }
    try {
      const data = await fetchCommunitySiteConfig();
      siteConfigCache = data;
      siteConfigCacheTime = Date.now();
      setConfig(data);
      Taro.setStorageSync('worker-house-site-config', data);
    } catch (err) {
      console.warn('[hooks] fetch site config failed', err);
      const cached = Taro.getStorageSync('worker-house-site-config') as SiteConfigRecord | undefined;
      if (cached) {
        setConfig(cached);
      }
    }
  };

  useDidShow(() => {
    void loadConfig();
  });

  useEffect(() => {
    void loadConfig();
  }, []);

  return config;
}

let cardPackagesCache: CardPackage[] | null = null;
let cardPackagesCacheTime = 0;

export function useCardPackages() {
  const [packages, setPackages] = useState<CardPackage[]>(cardPackagesCache || []);

  const loadPackages = async () => {
    if (cardPackagesCache && Date.now() - cardPackagesCacheTime < TTL) {
      setPackages(cardPackagesCache);
      return;
    }
    try {
      const data = await fetchCardPackages();
      cardPackagesCache = data;
      cardPackagesCacheTime = Date.now();
      setPackages(data);
    } catch (err) {
      console.warn('[hooks] fetch card packages failed', err);
    }
  };

  useDidShow(() => {
    void loadPackages();
  });

  useEffect(() => {
    void loadPackages();
  }, []);

  return packages;
}
