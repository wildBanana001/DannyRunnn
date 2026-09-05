export interface WxLoginResult {
  openid: string;
  nickname: string;
  avatar: string;
  isNew: boolean;
}

export interface WxUserProfile {
  openid: string;
  nickname: string;
  avatar: string;
  createdAt: string;
  updatedAt: string;
}
