import { useCallback, useEffect, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { emptySiteConfigRecord, fetchCommunitySiteConfig, type SiteConfigRecord } from '@/services/siteConfig';
import { fetchCardPackages } from '@/services/member';
import type { CardPackage } from '@/types';

let siteConfigCache: SiteConfigRecord | null = null;
let siteConfigCacheTime = 0;
let siteConfigGeneration = 0;
let siteConfigRequest: Promise<SiteConfigRecord> | null = null;
let siteConfigSettled = false;
const siteConfigListeners = new Set<(config: SiteConfigRecord) => void>();
const SITE_CONFIG_TTL = 60 * 1000;
const CARD_PACKAGES_TTL = 15 * 60 * 1000;

function requestSiteConfig() {
  if (!siteConfigRequest) {
    siteConfigRequest = fetchCommunitySiteConfig().finally(() => {
      siteConfigRequest = null;
    });
  }
  return siteConfigRequest;
}

export function clearSiteConfigCache() {
  siteConfigGeneration += 1;
  siteConfigCache = null;
  siteConfigCacheTime = 0;
  siteConfigRequest = null;
  siteConfigSettled = false;
  Taro.removeStorageSync('worker-house-site-config');
  siteConfigListeners.forEach((listener) => listener(emptySiteConfigRecord));
}

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfigRecord>(() => siteConfigCache || emptySiteConfigRecord);

  useEffect(() => {
    siteConfigListeners.add(setConfig);
    return () => {
      siteConfigListeners.delete(setConfig);
    };
  }, []);

  const loadConfig = useCallback(async () => {
    if (siteConfigCache && Date.now() - siteConfigCacheTime < SITE_CONFIG_TTL) {
      setConfig(siteConfigCache);
      return;
    }
    const generation = siteConfigGeneration;
    try {
      const data = await requestSiteConfig();
      if (generation !== siteConfigGeneration) return;
      siteConfigCache = data;
      siteConfigCacheTime = Date.now();
      siteConfigSettled = true;
      setConfig(data);
      siteConfigListeners.forEach((listener) => listener(data));
    } catch (err) {
      console.warn('[hooks] fetch site config failed', err);
      if (generation !== siteConfigGeneration) return;
      siteConfigCache = null;
      siteConfigCacheTime = 0;
      siteConfigSettled = true;
      setConfig(emptySiteConfigRecord);
      siteConfigListeners.forEach((listener) => listener(emptySiteConfigRecord));
      Taro.removeStorageSync('worker-house-site-config');
    }
  }, []);

  useDidShow(() => {
    void loadConfig();
  });

  return config;
}

export function useCommunityWallFeature() {
  const config = useSiteConfig();
  return {
    enabled: config.communityWallEnabled,
    loading: !siteConfigSettled,
  };
}

let cardPackagesCache: CardPackage[] | null = null;
let cardPackagesCacheTime = 0;

export function useCardPackages() {
  const [packages, setPackages] = useState<CardPackage[]>(cardPackagesCache || []);

  const loadPackages = async () => {
    if (cardPackagesCache && Date.now() - cardPackagesCacheTime < CARD_PACKAGES_TTL) {
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

  return packages;
}
