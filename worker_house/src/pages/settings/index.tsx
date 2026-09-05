import React, { useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { resetLocalPostData } from '@/cloud/services';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  clearLocalAccountData,
  deleteAccount,
  fetchAccountDeletionPreview,
  finishAccountDataCleanup,
  type AccountDeletionPreview,
} from '@/services/account';
import { ApiRequestError } from '@/services/apiError';
import { clearSiteConfigCache, useSiteConfig } from '@/shared/siteConfig';
import { useUserStore } from '@/store/userStore';
import styles from './index.module.scss';

interface EditableModalResult extends Taro.showModal.SuccessCallbackResult {
  content?: string;
}

type EditableShowModal = (option: Taro.showModal.Option & {
  editable: true;
  placeholderText: string;
}) => Promise<EditableModalResult>;

function getBlockedPreview(error: unknown) {
  if (!(error instanceof ApiRequestError) || error.statusCode !== 409) return null;
  const payload = error.responseData && typeof error.responseData === 'object'
    ? error.responseData as { preview?: AccountDeletionPreview }
    : null;
  return payload?.preview ?? null;
}

async function showDeletionBlockers(preview: AccountDeletionPreview) {
  const visibleBlockers = preview.blockers.slice(0, 3);
  const content = visibleBlockers
    .map((item, index) => `${index + 1}. ${item.title}：${item.detail}`)
    .join('\n');
  const remaining = preview.blockers.length - visibleBlockers.length;
  await Taro.showModal({
    title: '暂时无法注销',
    content: `${content}${remaining > 0 ? `\n另有 ${remaining} 项待处理` : ''}`,
    showCancel: false,
    confirmText: '我知道了',
    confirmColor: '#E60000',
  });
}

const SettingsPage: React.FC = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const logout = useUserStore((state) => state.logout);
  const sharedSiteConfig = useSiteConfig();
  const aboutUs = sharedSiteConfig.aboutUs;

  const handleClearCache = async () => {
    clearSiteConfigCache();
    Taro.showToast({ title: '缓存已清理', icon: 'success' });
  };

  const handleAbout = async () => {
    await Taro.showModal({
      title: '关于我们',
      content: aboutUs || '站点介绍暂不可用，请稍后再试。',
      showCancel: false,
      confirmColor: '#E60000'
    });
  };

  const handlePrivacyGuide = async () => {
    const openPrivacyContract = (Taro as typeof Taro & {
      openPrivacyContract?: () => Promise<unknown>;
    }).openPrivacyContract;
    if (!openPrivacyContract) {
      Taro.showToast({ title: '请在微信小程序内查看', icon: 'none' });
      return;
    }
    try {
      await openPrivacyContract();
    } catch (error) {
      console.warn('[settings] open privacy contract failed', error);
    }
  };

  const handleLogout = async () => {
    const result = await Taro.showModal({
      title: '退出登录',
      content: '确认退出当前账号吗？',
      confirmColor: '#E60000'
    });

    if (!result.confirm) {
      return;
    }

    logout();
    Taro.showToast({ title: '已退出登录', icon: 'success' });
    setTimeout(() => {
      Taro.switchTab({ url: '/pages/mine/index' });
    }, 300);
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      Taro.showLoading({ title: '检查账号中…', mask: true });
      const preview = await fetchAccountDeletionPreview();
      Taro.hideLoading();

      if (!preview.canDelete) {
        await showDeletionBlockers(preview);
        return;
      }

      const warning = await Taro.showModal({
        title: '注销账号并删除数据',
        content: [
          '注销后无法恢复。个人资料、地址、报名档案、次卡记录及其他账号关联数据将删除。',
          preview.retention.orderCount > 0
            ? `另有 ${preview.retention.orderCount} 条支付凭证会依法去标识化留存，仅用于财务对账。`
            : '',
        ].filter(Boolean).join('\n\n'),
        cancelText: '暂不注销',
        confirmText: '继续',
        confirmColor: '#E60000',
      });
      if (!warning.confirm) return;

      const editableShowModal = Taro.showModal as unknown as EditableShowModal;
      const confirmation = await editableShowModal({
        title: '再次确认',
        content: `请输入“${ACCOUNT_DELETION_CONFIRMATION}”后确认`,
        editable: true,
        placeholderText: ACCOUNT_DELETION_CONFIRMATION,
        cancelText: '取消',
        confirmText: '确认注销',
        confirmColor: '#E60000',
      });
      if (!confirmation.confirm) return;
      if (confirmation.content?.trim() !== ACCOUNT_DELETION_CONFIRMATION) {
        Taro.showToast({ title: `请输入“${ACCOUNT_DELETION_CONFIRMATION}”`, icon: 'none' });
        return;
      }

      Taro.showLoading({ title: '正在删除数据…', mask: true });
      let result;
      try {
        result = await deleteAccount();
        await finishAccountDataCleanup(result);
      } catch (error) {
        const blockedPreview = getBlockedPreview(error);
        if (blockedPreview) {
          Taro.hideLoading();
          await showDeletionBlockers(blockedPreview);
          return;
        }
        throw error;
      }

      clearLocalAccountData();
      resetLocalPostData();
      logout();
      Taro.hideLoading();

      await Taro.showModal({
        title: '账号已注销',
        content: result.retained.anonymizedOrders > 0
          ? `个人数据已删除。${result.retained.anonymizedOrders} 条支付凭证已去标识化留存。`
          : '账号及个人数据已删除，感谢你的使用。',
        showCancel: false,
        confirmText: '完成',
        confirmColor: '#E60000',
      });
      await Taro.reLaunch({ url: '/pages/home/index' });
    } catch (error) {
      Taro.hideLoading();
      console.warn('[settings] account deletion failed', error);
      await Taro.showModal({
        title: '注销未完成',
        content: error instanceof Error ? error.message : '请检查网络后稍后重试',
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#E60000',
      });
    } finally {
      Taro.hideLoading();
      setIsDeleting(false);
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.list}>
        <View className={styles.item} onClick={handleClearCache}>
          <Text className={styles.title}>清缓存</Text>
          <Text className={styles.arrow}>›</Text>
        </View>
        <View className={styles.item} onClick={handleAbout}>
          <Text className={styles.title}>关于我们</Text>
          <Text className={styles.arrow}>›</Text>
        </View>
        <View className={styles.item} onClick={handlePrivacyGuide}>
          <Text className={styles.title}>隐私保护指引</Text>
          <Text className={styles.arrow}>›</Text>
        </View>
        <View className={styles.item} onClick={handleLogout}>
          <Text className={styles.logoutTitle}>退出登录</Text>
          <Text className={styles.arrow}>›</Text>
        </View>
        <View
          className={`${styles.item} ${styles.dangerItem}`}
          onClick={() => void handleDeleteAccount()}
        >
          <View className={styles.titleBlock}>
            <Text className={styles.dangerTitle}>{isDeleting ? '正在处理…' : '注销账号与删除数据'}</Text>
            <Text className={styles.description}>删除个人资料、地址、报名、次卡及其他账号关联数据</Text>
          </View>
          <Text className={styles.arrow}>›</Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default SettingsPage;
