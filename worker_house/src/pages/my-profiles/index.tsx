import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import BottomSheet from '@/components/BottomSheet';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ProfileForm from '@/components/ProfileForm';
import { fetchProfiles, removeProfile, saveProfile, setDefaultProfile } from '@/services/member';
import type { Profile, ProfileFormValue } from '@/types';
import { buildProfileMeta, formatProfileTags } from '@/utils/profile';
import styles from './index.module.scss';

const SHEET_CLOSE_DURATION = 280;

const buildFormValue = (profile?: Profile, nextIsDefault = false): ProfileFormValue => ({
  nickname: profile?.nickname || '',
  wechatName: profile?.wechatName || '',
  phone: profile?.phone || '',
  gender: profile?.gender,
  ageRange: profile?.ageRange || '',
  industry: profile?.industry || '',
  occupation: profile?.occupation || '',
  city: profile?.city || '',
  socialGoal: profile?.socialGoal || '',
  introduction: profile?.introduction || '',
  tags: profile?.tags ?? [],
  isDefault: profile?.isDefault ?? nextIsDefault,
});

const MyProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetState, setSheetState] = useState<'opening' | 'closing'>('opening');
  const [draftProfileId, setDraftProfileId] = useState<string | undefined>();
  const [formValue, setFormValue] = useState<ProfileFormValue>(buildFormValue(undefined, true));
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const profileList = await fetchProfiles();
      setProfiles(profileList);
    } catch (error) {
      console.warn('[my-profiles] load failed', error);
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  const openSheet = (profile?: Profile) => {
    setDraftProfileId(profile?.id);
    setFormValue(buildFormValue(profile, !profile && profiles.length === 0));
    setSheetVisible(true);
    setSheetState('opening');
  };

  const closeSheet = () => {
    setSheetState('closing');
    setTimeout(() => {
      setSheetVisible(false);
      setSheetState('opening');
    }, SHEET_CLOSE_DURATION);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfile({ ...formValue, id: draftProfileId });
      Taro.showToast({ title: '档案已保存', icon: 'success' });
      closeSheet();
      await loadData();
    } catch (error) {
      console.warn('[my-profiles] save failed', error);
      Taro.showToast({ title: '保存失败，请稍后再试', icon: 'none' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (profile: Profile) => {
    Taro.showModal({
      title: '删除这份档案？',
      content: `删除后，「${profile.nickname || '未命名档案'}」不会再出现在报名选择里。`,
      success: async (result) => {
        if (!result.confirm) {
          return;
        }
        try {
          await removeProfile(profile.id);
          Taro.showToast({ title: '已删除', icon: 'success' });
          await loadData();
        } catch (error) {
          console.warn('[my-profiles] delete failed', error);
          Taro.showToast({ title: '删除失败，请稍后重试', icon: 'none' });
        }
      }
    });
  };

  const handleSetDefault = async (profile: Profile) => {
    try {
      await setDefaultProfile(profile.id);
      Taro.showToast({ title: '已设为默认档案', icon: 'success' });
      await loadData();
    } catch (error) {
      console.warn('[my-profiles] set default failed', error);
      Taro.showToast({ title: '设置失败，请稍后重试', icon: 'none' });
    }
  };

  return (
    <View className={styles.container}>
      <ScrollView className={styles.scrollView} scrollY enableFlex>
        <View className={styles.headerCard}>
          <Text className={styles.title}>我的社畜档案</Text>
          <Text className={styles.description}>档案会被带进报名快照里。写得越完整，之后报名越省心。</Text>
        </View>

        {profiles.length > 0 ? (
          <View className={styles.list}>
            {profiles.map((profile) => (
              <View key={profile.id} className={styles.card}>
                <View className={styles.cardTop}>
                  <View>
                    <Text className={styles.name}>{profile.nickname || '未命名档案'}</Text>
                    <Text className={styles.meta}>{buildProfileMeta(profile)}</Text>
                  </View>
                  {profile.isDefault ? <Text className={styles.defaultBadge}>默认</Text> : null}
                </View>
                <Text className={styles.activityLine}>社交目标：{profile.socialGoal || '还没写下你想在这里遇见什么样的人。'}</Text>
                <Text className={styles.activityLine}>标签：{formatProfileTags(profile.tags)}</Text>
                <Text className={styles.excerpt}>{profile.introduction || '还没写介绍，留点故事给未来认识你的人吧。'}</Text>
                <View className={styles.actions}>
                  {!profile.isDefault ? <Text className={styles.action} onClick={() => handleSetDefault(profile)}>设为默认</Text> : null}
                  <Text className={styles.action} onClick={() => openSheet(profile)}>编辑</Text>
                  <Text className={styles.deleteAction} onClick={() => handleDelete(profile)}>删除</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="先建一份自己的档案吧" description="以后从活动详情进报名页时，就能直接选这份档案继续。" />
        )}

        <View className={styles.createWrap}>
          <Button type="primary" size="large" block onClick={() => openSheet()}>
            新建档案
          </Button>
        </View>
        <View className={styles.bottomSpacing} />
      </ScrollView>

      <BottomSheet visible={sheetVisible} state={sheetState} onClose={closeSheet} height="82vh" bodyClassName={styles.sheetBody}>
        <ProfileForm
          value={formValue}
          title={draftProfileId ? '编辑档案' : '新建档案'}
          description="这里保存的是你自己的长期档案，不一定跟某一次报名完全一致。"
          submitText={isSaving ? '保存中...' : '保存档案'}
          cancelText="先不改了"
          onChange={(patch) => setFormValue((prev) => ({ ...prev, ...patch }))}
          onSubmit={() => !isSaving && handleSave()}
          onCancel={closeSheet}
        />
      </BottomSheet>
    </View>
  );
};

export default MyProfilesPage;
