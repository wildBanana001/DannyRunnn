import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import SafeImage from '@/components/SafeImage';
import activityImageFallback from '@/assets/home/space-room-v2.jpg';
import { MEMBER_CARD_ENABLED } from '@/constants/capabilities';
import { usePaymentErrorDialog } from '@/hooks/usePaymentErrorDialog';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import {
  confirmActivityPayment,
  createActivityPaymentClientRequestId,
  fetchCurrentCardOrder,
  fetchProfiles,
  fetchRegistrationActivity,
  isActivityPaymentCancelled,
  isDirectActivityPaymentEnabled,
  launchActivityPayment,
  saveProfile,
  submitRegistrationOrder,
} from '@/services/member';
import type { Activity, CardOrder, Profile, ProfileFormValue } from '@/types';
import { formatDate, formatPrice } from '@/utils/helpers';
import {
  ProfileSelectionPanel,
  ProfileSnapshotPanel,
  RegistrationSuccessModal,
} from './RegisterPanels';
import ProfileForm from '@/components/ProfileForm';
import styles from './index.module.scss';

type RegisterStep = 1 | 2 | 3;

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

const buildTransientProfile = (value: ProfileFormValue, clientRequestId: string): Profile => {
  const timestamp = new Date().toISOString();
  return {
    id: `registration-profile-${clientRequestId}`,
    nickname: value.nickname.trim() || '未命名用户',
    wechatName: value.wechatName.trim(),
    phone: value.phone?.trim() || undefined,
    gender: value.gender ?? 'other',
    ageRange: value.ageRange.trim(),
    industry: value.industry.trim(),
    occupation: value.occupation.trim(),
    city: value.city.trim(),
    socialGoal: value.socialGoal.trim(),
    introduction: value.introduction.trim(),
    tags: value.tags.map((item) => item.trim()).filter(Boolean),
    isDefault: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const RegisterPage: React.FC = () => {
  const viewportStyle = useViewportLayout();
  const router = useRouter();
  const activityId = router.params.activityId?.trim() || router.params.id?.trim() || '';
  const [step, setStep] = useState<RegisterStep>(1);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');
  const [memberNotice, setMemberNotice] = useState('');
  const [profileServiceAvailable, setProfileServiceAvailable] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [transientProfile, setTransientProfile] = useState<Profile | null>(null);
  const [currentCard, setCurrentCard] = useState<CardOrder | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | undefined>();
  const [formValue, setFormValue] = useState<ProfileFormValue>(buildProfileFormValue(undefined, true));
  const [useCard, setUseCard] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successRegistrationId, setSuccessRegistrationId] = useState('');
  const [clientRequestId] = useState(createActivityPaymentClientRequestId);
  const directPaymentEnabled = isDirectActivityPaymentEnabled();
  const registrationPrice = activity?.price || 0;
  const { paymentErrorDialog, showPaymentError } = usePaymentErrorDialog();

  const refreshMemberData = useCallback(async () => {
    const [profileResult, cardResult] = await Promise.allSettled([
      fetchProfiles(),
      MEMBER_CARD_ENABLED ? fetchCurrentCardOrder() : Promise.resolve(null),
    ]);
    let nextNotice = '';

    if (cardResult.status === 'fulfilled') {
      setCurrentCard(cardResult.value);
    } else {
      setCurrentCard(null);
      console.warn('[register] load card failed', cardResult.reason);
      nextNotice = '次卡信息暂不可用，本次报名将使用微信支付。';
    }

    if (profileResult.status === 'rejected') {
      console.warn('[register] load profiles failed', profileResult.reason);
      setProfileServiceAvailable(false);
      setProfiles([]);
      setMemberNotice('档案服务暂不可用，当前填写只用于本次报名。');
      setStep((currentStep) => currentStep === 3 ? currentStep : 2);
      return;
    }

    const profileList = profileResult.value;
    setProfileServiceAvailable(true);
    setProfiles(profileList);
    setMemberNotice(nextNotice);

    setSelectedProfileId((prevSelectedId) => {
      const preferredProfile = transientProfile?.id === prevSelectedId
        ? transientProfile
        : profileList.find((item) => item.id === prevSelectedId)
          || profileList.find((item) => item.isDefault)
          || profileList[0];
      return preferredProfile?.id || '';
    });

    if (profileList.length === 0 && !transientProfile) {
      setStep((currentStep) => currentStep === 3 ? currentStep : 2);
    }
  }, [transientProfile]);

  const loadPage = useCallback(async () => {
    setActivityLoading(true);
    setActivityError('');
    setMemberNotice('');
    void refreshMemberData().catch((error) => {
      console.warn('[register] load member data failed', error);
      setProfileServiceAvailable(false);
      setMemberNotice('档案服务暂不可用，当前填写只用于本次报名。');
      setStep((currentStep) => currentStep === 3 ? currentStep : 2);
    });

    try {
      if (!activityId) {
        throw new Error('缺少活动信息');
      }
      const nextActivity = await fetchRegistrationActivity(activityId);
      if (nextActivity.id !== activityId) {
        throw new Error('活动信息不匹配');
      }
      setActivity(nextActivity);
    } catch (error) {
      setActivity(null);
      setActivityError(error instanceof Error ? error.message : '活动加载失败');
    } finally {
      setActivityLoading(false);
    }
  }, [activityId, refreshMemberData]);

  useDidShow(() => {
    void loadPage();
  });

  useEffect(() => {
    if (directPaymentEnabled) {
      setUseCard(false);
      return;
    }
    const remainingCount = currentCard?.remainingCount || 0;
    setUseCard(Boolean(activity?.cardEligible && remainingCount > 0));
  }, [activity?.cardEligible, currentCard?.remainingCount, directPaymentEnabled]);

  const availableProfiles = useMemo(
    () => transientProfile
      ? [transientProfile, ...profiles.filter((item) => item.id !== transientProfile.id)]
      : profiles,
    [profiles, transientProfile]
  );

  const selectedProfile = useMemo(
    () => availableProfiles.find((item) => item.id === selectedProfileId) || availableProfiles[0],
    [availableProfiles, selectedProfileId]
  );

  const paymentSummary = useMemo(() => {
    if (!activity) {
      return { deductionAmount: 0, payableAmount: 0 };
    }
    const deductionAmount = MEMBER_CARD_ENABLED
      && useCard
      && activity.cardEligible
      && (currentCard?.remainingCount || 0) > 0
      ? Math.min(registrationPrice, currentCard?.perUseMaxOffset || 0)
      : 0;
    return {
      deductionAmount,
      payableAmount: Math.max(0, registrationPrice - deductionAmount),
    };
  }, [activity, currentCard?.perUseMaxOffset, currentCard?.remainingCount, registrationPrice, useCard]);

  const handleCreateProfile = () => {
    setTransientProfile(null);
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
    const continueWithTransientProfile = () => {
      const nextProfile = buildTransientProfile(formValue, clientRequestId);
      setTransientProfile(nextProfile);
      setSelectedProfileId(nextProfile.id);
      setEditingProfileId(nextProfile.id);
      setProfileServiceAvailable(false);
      setMemberNotice('档案服务暂不可用，当前填写只用于本次报名。');
      setStep(3);
      Taro.showToast({ title: '将使用当前填写内容报名', icon: 'none' });
    };

    if (!profileServiceAvailable) {
      if (goNext) {
        continueWithTransientProfile();
      } else {
        Taro.showToast({ title: '档案服务暂不可用', icon: 'none' });
      }
      return;
    }

    setIsSavingProfile(true);
    try {
      const remoteProfileId = editingProfileId === transientProfile?.id ? undefined : editingProfileId;
      const savedProfile = await saveProfile({ ...formValue, id: remoteProfileId });
      setProfiles((currentProfiles) => [
        savedProfile,
        ...currentProfiles.filter((item) => item.id !== savedProfile.id),
      ]);
      setTransientProfile(null);
      setSelectedProfileId(savedProfile.id);
      setEditingProfileId(savedProfile.id);
      setMemberNotice('');
      Taro.showToast({ title: '档案已保存', icon: 'success' });

      if (goNext) {
        setStep(3);
        return;
      }

      Taro.redirectTo({ url: '/pages/my-profiles/index' });
    } catch (error) {
      console.warn('[register] save profile failed', error);
      if (goNext) {
        continueWithTransientProfile();
      } else {
        Taro.showToast({ title: '保存失败，请稍后再试', icon: 'none' });
      }
    } finally {
      setIsSavingProfile(false);
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
    if (!activity || activity.id !== activityId) {
      Taro.showToast({ title: '活动信息尚未加载，请重试', icon: 'none' });
      return;
    }
    if (!selectedProfile) {
      Taro.showToast({ title: '请先选择一个档案', icon: 'none' });
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await submitRegistrationOrder({
        activityId: activity.id,
        profile: selectedProfile,
        useCard: directPaymentEnabled ? false : useCard,
        clientRequestId,
      });
      const displayedAmount = Math.round(paymentSummary.payableAmount * 100);
      if (session.status !== 'paid' && session.amount !== displayedAmount) {
        throw new Error('活动价格已更新，请返回活动详情刷新后重试');
      }
      if (session.status === 'paid' || session.registration.status === 'confirmed') {
        setSuccessRegistrationId(session.registration.id);
        return;
      }

      try {
        await launchActivityPayment(session);
      } catch (paymentError) {
        if (isActivityPaymentCancelled(paymentError)) {
          Taro.showToast({ title: '已取消支付，可在报名记录中继续', icon: 'none' });
          await Taro.redirectTo({
            url: `/pages/content/registration-detail/index?id=${encodeURIComponent(session.registration.id)}`,
          });
          return;
        }
        throw paymentError;
      }

      Taro.showLoading({ title: '正在确认支付…', mask: true });
      const confirmed = await confirmActivityPayment(session.registration.id);
      Taro.hideLoading();
      if (confirmed.status === 'confirmed' || confirmed.status === 'completed') {
        setSuccessRegistrationId(confirmed.id);
        return;
      }
      Taro.showToast({ title: '支付结果确认中，请稍后在报名记录查看', icon: 'none' });
      await Taro.redirectTo({
        url: `/pages/content/registration-detail/index?id=${encodeURIComponent(confirmed.id)}`,
      });
    } catch (error) {
      console.warn('[register] submit order failed', error);
      Taro.hideLoading();
      showPaymentError(error, '报名失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (activityLoading) {
    return <View className={styles.statePage} style={viewportStyle}><Text className={styles.stateText}>正在核对活动信息...</Text></View>;
  }

  if (!activity || activityError) {
    return (
      <View className={styles.statePage} style={viewportStyle}>
        <EmptyState title="暂时无法报名" description={activityError || '活动可能已结束或下架。'}>
          <Button block type="outline" onClick={() => void loadPage()}>重新加载</Button>
        </EmptyState>
      </View>
    );
  }

  return (
    <View className={styles.container} style={viewportStyle}>
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
          <SafeImage
            className={styles.activityCover}
            src={activity.cover || activity.coverImage}
            fallbackSrc={activityImageFallback}
            mode="aspectFill"
            fallbackDelayMs={2200}
          />
          <View className={styles.activityInfo}>
            <Text className={styles.activityTitle}>{activity.title}</Text>
            <Text className={styles.activityMeta}>{formatDate(activity.startDate)} · {activity.startTime}-{activity.endTime}</Text>
            <Text className={styles.activityPrice}>报名价 {formatPrice(registrationPrice)}</Text>
          </View>
        </View>

        {memberNotice ? (
          <View className={styles.sectionCard}>
            <Text className={styles.warningText}>{memberNotice}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <ProfileSelectionPanel
            profiles={availableProfiles}
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
              description={profileServiceAvailable
                ? '所有字段都可以空着，先把想写的写下来就好。'
                : '档案服务暂不可用，当前填写只用于本次报名。'}
              submitText={isSavingProfile ? '保存中...' : '保存并下一步'}
              secondaryActionText={profileServiceAvailable && !isSavingProfile ? '仅保存档案' : undefined}
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
              <Text className={styles.sectionTitle}>{MEMBER_CARD_ENABLED ? '报名支付' : '微信支付'}</Text>
              {!MEMBER_CARD_ENABLED ? (
                <Text className={styles.paymentNotice}>报名金额由服务端核算。支付完成后，以微信支付服务端确认结果为准。</Text>
              ) : (
              <View className={styles.cardToggleRow}>
                <View>
                  <Text className={styles.toggleTitle}>使用社畜次卡</Text>
                  <Text className={styles.toggleDesc}>
                    当前剩余 {currentCard?.remainingCount || 0} 次
                    {(currentCard?.perUseMaxOffset || 0) > 0 ? `，单次最高抵扣 ${formatPrice(currentCard?.perUseMaxOffset || 0)}` : ''}。
                  </Text>
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
              )}
              {MEMBER_CARD_ENABLED && !activity.cardEligible ? <Text className={styles.warningText}>这场活动暂不支持次卡抵扣，仍可使用微信支付。</Text> : null}
              {MEMBER_CARD_ENABLED && activity.cardEligible && (currentCard?.remainingCount || 0) <= 0 ? (
                <Text className={styles.warningText}>当前没有可用次卡，本次可使用微信支付。</Text>
              ) : null}

              <View className={styles.pricePanel}>
                <View className={styles.priceRow}><Text className={styles.priceLabel}>报名价</Text><Text className={styles.priceValue}>{formatPrice(registrationPrice)}</Text></View>
                {MEMBER_CARD_ENABLED ? (
                  <View className={styles.priceRow}><Text className={styles.priceLabel}>抵扣</Text><Text className={styles.discountValue}>- {formatPrice(paymentSummary.deductionAmount)}</Text></View>
                ) : null}
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
            <Button type="primary" size="large" block className={styles.footerPrimary} disabled={!selectedProfile} onClick={() => setStep(3)}>
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
            <Button type="primary" size="large" block className={styles.footerPrimary} loading={isSubmitting} disabled={isSubmitting} onClick={handleSubmitOrder}>
              {paymentSummary.payableAmount > 0 ? `微信支付 ${formatPrice(paymentSummary.payableAmount)}` : '确认免费报名'}
            </Button>
          </>
        ) : null}
      </View>

      <RegistrationSuccessModal
        visible={Boolean(successRegistrationId)}
        onClose={handleCloseSuccessModal}
      />
      {paymentErrorDialog}
    </View>
  );
};

export default RegisterPage;
