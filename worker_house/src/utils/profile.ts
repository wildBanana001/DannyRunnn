import type { Profile, ProfileGender } from '@/types';

type ProfileMetaSource = Pick<Profile, 'ageRange' | 'occupation' | 'industry' | 'city'>;

const profileGenderTextMap: Record<ProfileGender, string> = {
  male: '男🙋‍♂️',
  female: '女🙋‍♀️',
  other: '其他 / 不方便说明',
};

export const formatProfileGender = (gender?: ProfileGender): string => {
  if (!gender) {
    return '未填写';
  }

  return profileGenderTextMap[gender] || '未填写';
};

export const buildProfileMeta = (profile: ProfileMetaSource): string => {
  const meta = [profile.ageRange, profile.occupation || profile.industry, profile.city]
    .map((item) => item?.trim())
    .filter(Boolean);

  return meta.join(' · ') || '信息待补充';
};

export const formatProfileTags = (tags?: string[]): string => {
  const normalizedTags = (tags || []).map((item) => item.trim()).filter(Boolean);
  return normalizedTags.length > 0 ? normalizedTags.join(' / ') : '未填写';
};

export const parseProfileTags = (value: string): string[] => {
  return Array.from(
    new Set(
      value
        .split(/[，,、\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
};
