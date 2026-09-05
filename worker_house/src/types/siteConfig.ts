export interface HomeOwnerCard {
  id: string;
  avatar: string;
  label: string;
  description: string;
}

export interface SiteConfigRecord {
  communityWallEnabled: boolean;
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
