import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import SafeImage from '@/components/SafeImage';
import { fetchActivityDetail } from '@/cloud/services';
import { calculateCardDeduction } from '@/data/mock-member';
import {
  confirmActivityPayment,
  createActivityPaymentClientRequestId,
  fetchCurrentCardOrder,
  fetchProfiles,
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

const RegisterPage: React.FC = () => {
  const router = useRouter();
  const activityId = router.params.activityId?.trim() || router.params.id?.trim() || '';
  const [step, setStep] = useState<RegisterStep>(1);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');
  const [memberError, setMemberError] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
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

  const refreshMemberData = useCallback(async () => {
    const [profileResult, cardResult] = await Promise.allSettled([fetchProfiles(), fetchCurrentCardOrder()]);
    if (cardResult.status === 'fulfilled') {
      setCurrentCard(cardResult.value);
    } else {
      setCurrentCard(null);
      console.warn('[register] load card failed', cardResult.reason);
    }
    if (profileResult.status === 'rejected') {
      throw new Error('报名档案加载失败，请重试');
    }

    const profileList = profileResult.value;
    setProfiles(profileList);

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
    setActivityLoading(true);
    setActivityError('');
    setMemberError('');
    const [activityResult, memberResult] = await Promise.allSettled([
      activityId ? fetchActivityDetail(activityId) : Promise.reject(new Error('缺少活动信息')),
      refreshMemberData(),
    ]);

    if (activityResult.status === 'fulfilled' && activityResult.value.id === activityId) {
      setActivity(activityResult.value);
    } else {
      const reason = activityResult.status === 'rejected' ? activityResult.reason : new Error('活动信息不匹配');
      setActivity(null);
      setActivityError(reason instanceof Error ? reason.message : '活动加载失败');
    }
    if (memberResult.status === 'rejected') {
      console.warn('[register] load member data failed', memberResult.reason);
      setMemberError(memberResult.reason instanceof Error ? memberResult.reason.message : '报名档案加载失败');
    }
    setActivityLoading(false);
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

  const selectedProfile = useMemo(
    () => profiles.find((item) => item.id === selectedProfileId) || profiles[0],
    [profiles, selectedProfileId]
  );

  const paymentSummary = useMemo(() => {
    if (!activity) {
      return { deductionAmount: 0, payableAmount: 0 };
    }
    const remainingCount = currentCard?.remainingCount || 0;
    const deductionAmount = calculateCardDeduction(
      activity.price,
      directPaymentEnabled ? false : useCard,
      Boolean(activity.cardEligible),
      remainingCount
    );
    return {
      deductionAmount,
      payableAmount: Math.max(0, activity.price - deductionAmount),
    };
  }, [activity, currentCard?.remainingCount, directPaymentEnabled, useCard]);

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
      const message = error instanceof Error ? error.message : '报名失败，请稍后再试';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (activityLoading) {
    return <View className={styles.statePage}><Text className={styles.stateText}>正在核对活动信息...</Text></View>;
  }

  if (!activity || activityError) {
    return (
      <View className={styles.statePage}>
        <EmptyState title="暂时无法报名" description={activityError || '活动可能已结束或下架。'}>
          <Button block type="outline" onClick={() => void loadPage()}>重新加载</Button>
        </EmptyState>
      </View>
    );
  }

  if (memberError) {
    return (
      <View className={styles.statePage}>
        <EmptyState title="报名资料加载失败" description={memberError}>
          <Button block type="outline" onClick={() => void loadPage()}>重新加载</Button>
        </EmptyState>
      </View>
    );
  }

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
          <SafeImage className={styles.activityCover} src={activity.cover || activity.coverImage} mode="aspectFill" fallbackDelayMs={2200} />
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
              <Text className={styles.sectionTitle}>{directPaymentEnabled ? '微信支付' : '次卡抵扣'}</Text>
              {directPaymentEnabled ? (
                <Text className={styles.paymentNotice}>报名金额由服务端核算。支付完成后，以微信支付服务端确认结果为准。</Text>
              ) : (
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
              )}
              {!directPaymentEnabled && !activity.cardEligible ? <Text className={styles.warningText}>这场活动暂不支持次卡抵扣，仍可直接完成报名。</Text> : null}
              {!directPaymentEnabled && activity.cardEligible && (currentCard?.remainingCount || 0) <= 0 ? (
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
              {paymentSummary.payableAmount > 0 ? `微信支付 ${formatPrice(paymentSummary.payableAmount)}` : '确认免费报名'}
            </Button>
          </>
        ) : null}
      </View>

      <RegistrationSuccessModal
        visible={Boolean(successRegistrationId)}
        onClose={handleCloseSuccessModal}
      />
    </View>
  );
};

export default RegisterPage;
