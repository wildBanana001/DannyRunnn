import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import ProfileForm from '@/components/ProfileForm';
import { fetchActivityDetail } from '@/cloud/services';
import { calculateCardDeduction } from '@/data/mock-member';
import { featuredActivity } from '@/data/activities';
import { fetchCurrentCardOrder, fetchProfiles, saveProfile, submitRegistrationOrder } from '@/services/member';
import { useSiteConfig } from '@/shared/siteConfig';
import type { Activity, CardOrder, Profile, ProfileFormValue } from '@/types';
import { formatDate, formatPrice } from '@/utils/helpers';
import {
  ProfileSelectionPanel,
  ProfileSnapshotPanel,
  RegistrationSuccessModal,
} from './RegisterPanels';
import styles from './index.module.scss';

type RegisterStep = 1 | 2 | 3;

const loadingWechatText = '加载中...';
const fallbackWechatText = '请联系工作人员';

const buildProfileFormValue = (profile?: Profile, nextIsDefault = false): ProfileFormValue => ({
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

const RegisterPage: React.FC = () => {
  const router = useRouter();
  const activityId = router.params.activityId || router.params.id || featuredActivity.id;
  const [step, setStep] = useState<RegisterStep>(1);
  const [activity, setActivity] = useState<Activity>(featuredActivity);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentCard, setCurrentCard] = useState<CardOrder | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | undefined>();
  const [formValue, setFormValue] = useState<ProfileFormValue>(buildProfileFormValue(undefined, true));
  const [useCard, setUseCard] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successRegistrationId, setSuccessRegistrationId] = useState('');
  const sharedSiteConfig = useSiteConfig();
  const contactWechat = sharedSiteConfig?.contactWechat || fallbackWechatText;

  const refreshMemberData = useCallback(async () => {
    const [profileList, cardOrder] = await Promise.all([fetchProfiles(), fetchCurrentCardOrder()]);
    setProfiles(profileList);
    setCurrentCard(cardOrder);

    setSelectedProfileId((prevSelectedId) => {
      const preferredProfile = profileList.find((item) => item.id === prevSelectedId) || profileList.find((item) => item.isDefault) || profileList[0];
      return preferredProfile?.id || '';
    });

    if (profileList.length === 0) {
      setStep(2);
      setEditingProfileId(undefined);
      setFormValue(buildProfileFormValue(undefined, true));
    }
  }, []);

  const loadPage = useCallback(async () => {
    try {
      const detail = await fetchActivityDetail(activityId);
      setActivity(detail);
      await refreshMemberData();
    } catch (error) {
      console.warn('[register] load page failed', error);
      setActivity(featuredActivity);
      await refreshMemberData();
    }
  }, [activityId, refreshMemberData]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useDidShow(() => {
    void loadPage();
  });

  useEffect(() => {
    const remainingCount = currentCard?.remainingCount || 0;
    setUseCard(Boolean(activity.cardEligible && remainingCount > 0));
  }, [activity.cardEligible, currentCard?.remainingCount]);

  const selectedProfile = useMemo(
    () => profiles.find((item) => item.id === selectedProfileId) || profiles[0],
    [profiles, selectedProfileId]
  );

  const paymentSummary = useMemo(() => {
    const remainingCount = currentCard?.remainingCount || 0;
    const deductionAmount = calculateCardDeduction(activity.price, useCard, Boolean(activity.cardEligible), remainingCount);
    return {
      deductionAmount,
      payableAmount: Math.max(0, activity.price - deductionAmount),
    };
  }, [activity.cardEligible, activity.price, currentCard?.remainingCount, useCard]);

  const handleCreateProfile = () => {
    setEditingProfileId(undefined);
    setFormValue(buildProfileFormValue(undefined, profiles.length === 0));
    setStep(2);
  };

  const handleEditProfile = (profile: Profile) => {
    setEditingProfileId(profile.id);
    setFormValue(buildProfileFormValue(profile, profile.isDefault));
    setStep(2);
  };

  const handleSaveProfile = async (goNext: boolean) => {
    setIsSavingProfile(true);
    try {
      const savedProfile = await saveProfile({ ...formValue, id: editingProfileId });
      const latestProfiles = await fetchProfiles();
      setProfiles(latestProfiles);
      setSelectedProfileId(savedProfile.id);
      setEditingProfileId(savedProfile.id);
      Taro.showToast({ title: '档案已保存', icon: 'success' });

      if (goNext) {
        setStep(3);
        return;
      }

      Taro.redirectTo({ url: '/pages/my-profiles/index' });
    } catch (error) {
      console.warn('[register] save profile failed', error);
      Taro.showToast({ title: '保存失败，请稍后再试', icon: 'none' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCopyWechat = async () => {
    if (!contactWechat || contactWechat === loadingWechatText || contactWechat === fallbackWechatText) {
      Taro.showToast({ title: fallbackWechatText, icon: 'none' });
      return;
    }

    try {
      await Taro.setClipboardData({ data: contactWechat });
      Taro.showToast({ title: '微信号已复制', icon: 'success' });
    } catch (error) {
      console.warn('[register] copy wechat failed', error);
      Taro.showToast({ title: '复制失败，请稍后再试', icon: 'none' });
    }
  };

  const handleCloseSuccessModal = () => {
    const targetUrl = successRegistrationId
      ? `/pages/content/my-registrations/index?highlight=${successRegistrationId}`
      : '/pages/content/my-registrations/index';
    setSuccessRegistrationId('');
    Taro.redirectTo({ url: targetUrl });
  };

  const handleSubmitOrder = async () => {
    if (!selectedProfile) {
      Taro.showToast({ title: '请先选择一个档案', icon: 'none' });
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const registration = await submitRegistrationOrder({
        activityId: activity.id,
        profileId: selectedProfile.id,
        useCard,
      });
      setSuccessRegistrationId(registration.id);
    } catch (error) {
      console.warn('[register] submit order failed', error);
      Taro.showToast({ title: '报名失败，请稍后再试', icon: 'none' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className={styles.container}>
      <ScrollView className={styles.scrollView} scrollY enableFlex>
        <View className={styles.progressWrap}>
          {[1, 2, 3].map((item) => (
            <View key={item} className={styles.progressItem}>
              <View className={item <= step ? styles.progressDotActive : styles.progressDot}>{item}</View>
              <Text className={item <= step ? styles.progressTextActive : styles.progressText}>
                {item === 1 ? '选档案' : item === 2 ? '写档案' : '确认订单'}
              </Text>
            </View>
          ))}
        </View>

        <View className={styles.activityCard}>
          <Image className={styles.activityCover} src={activity.cover || activity.coverImage} mode="aspectFill" />
          <View className={styles.activityInfo}>
            <Text className={styles.activityTitle}>{activity.title}</Text>
            <Text className={styles.activityMeta}>{formatDate(activity.startDate)} · {activity.startTime}-{activity.endTime}</Text>
            <Text className={styles.activityPrice}>原价 {formatPrice(activity.price)}</Text>
          </View>
        </View>

        {step === 1 ? (
          <ProfileSelectionPanel
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onCreate={handleCreateProfile}
            onEdit={handleEditProfile}
            onSelect={setSelectedProfileId}
          />
        ) : null}

        {step === 2 ? (
          <View className={styles.stepSection}>
            <ProfileForm
              value={formValue}
              title={editingProfileId ? '编辑这份社畜档案' : '新建一份社畜档案'}
              description="所有字段都可以空着，先把想写的写下来就好。"
              submitText={isSavingProfile ? '保存中...' : '保存并下一步'}
              secondaryActionText={isSavingProfile ? undefined : '仅保存档案'}
              cancelText="返回上一步"
              onChange={(patch) => setFormValue((prev) => ({ ...prev, ...patch }))}
              onSubmit={() => !isSavingProfile && handleSaveProfile(true)}
              onSecondaryAction={() => !isSavingProfile && handleSaveProfile(false)}
              onCancel={() => setStep(1)}
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View className={styles.stepSection}>
            <ProfileSnapshotPanel profile={selectedProfile} onEdit={() => selectedProfile && handleEditProfile(selectedProfile)} />

            <View className={styles.sectionCard}>
              <Text className={styles.sectionTitle}>次卡抵扣</Text>
              <View className={styles.cardToggleRow}>
                <View>
                  <Text className={styles.toggleTitle}>使用社畜次卡</Text>
                  <Text className={styles.toggleDesc}>当前剩余 {currentCard?.remainingCount || 0} 次，可单次最高抵扣 ¥148。</Text>
                </View>
                <View
                  className={activity.cardEligible && (currentCard?.remainingCount || 0) > 0 ? (useCard ? styles.toggleActive : styles.toggle) : styles.toggleDisabled}
                  onClick={() => {
                    if (!activity.cardEligible) {
                      return;
                    }
                    if ((currentCard?.remainingCount || 0) <= 0) {
                      return;
                    }
                    setUseCard((prev) => !prev);
                  }}
                >
                  <View className={useCard ? styles.toggleThumbActive : styles.toggleThumb} />
                </View>
              </View>
              {!activity.cardEligible ? <Text className={styles.warningText}>这场活动暂不支持次卡抵扣，仍可直接完成报名。</Text> : null}
              {activity.cardEligible && (currentCard?.remainingCount || 0) <= 0 ? (
                <Text className={styles.warningText} onClick={() => Taro.navigateTo({ url: '/pages/my-cards/index' })}>当前没有可用次卡，去「社畜次卡」页面买一张再回来也行。</Text>
              ) : null}

              <View className={styles.pricePanel}>
                <View className={styles.priceRow}><Text className={styles.priceLabel}>原价</Text><Text className={styles.priceValue}>{formatPrice(activity.price)}</Text></View>
                <View className={styles.priceRow}><Text className={styles.priceLabel}>抵扣</Text><Text className={styles.discountValue}>- {formatPrice(paymentSummary.deductionAmount)}</Text></View>
                <View className={styles.priceRowStrong}><Text className={styles.priceStrongLabel}>实付</Text><Text className={styles.priceStrongValue}>{formatPrice(paymentSummary.payableAmount)}</Text></View>
              </View>
            </View>
          </View>
        ) : null}

        <View className={styles.bottomSpacing} />
      </ScrollView>

      <View className={styles.footerBar}>
        {step === 1 ? (
          <>
            <Button type="ghost" size="medium" className={styles.footerGhost} onClick={() => Taro.navigateBack()}>先不报了</Button>
            <Button type="primary" size="large" block disabled={!selectedProfile} onClick={() => setStep(3)}>
              继续确认订单
            </Button>
          </>
        ) : null}

        {step === 2 ? (
          <Button type="ghost" size="medium" block onClick={() => setStep(1)}>回到档案列表</Button>
        ) : null}

        {step === 3 ? (
          <>
            <Button type="outline" size="medium" className={styles.footerGhost} onClick={() => setStep(1)}>切换档案</Button>
            <Button type="primary" size="large" block loading={isSubmitting} disabled={isSubmitting} onClick={handleSubmitOrder}>
              提交报名
            </Button>
          </>
        ) : null}
      </View>

      <RegistrationSuccessModal
        visible={Boolean(successRegistrationId)}
        onClose={handleCloseSuccessModal}
        onCopyWechat={() => void handleCopyWechat()}
        wechatId={contactWechat}
      />
    </View>
  );
};

export default RegisterPage;
