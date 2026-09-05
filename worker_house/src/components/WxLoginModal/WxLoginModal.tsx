import React, { useState } from 'react';
import { Button as TaroButton, Input, Text, View, Image } from '@tarojs/components';
import Button from '@/components/Button';
import loginLogo from '@/assets/home/hero-cover.jpg';
import { getMockLoginPreset } from '@/data/mock-member';
import { getApiMode } from '@/services/request';
import { useUserStore } from '@/store/userStore';
import styles from './WxLoginModal.module.scss';

interface WxLoginModalProps {
  visible: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

const WxLoginModal: React.FC<WxLoginModalProps> = ({ visible, onClose, onSuccess }) => {
  const loginWithWx = useUserStore((state) => state.loginWithWx);
  const [loginNickname, setLoginNickname] = useState('');
  const [loginAvatar, setLoginAvatar] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMockMode = getApiMode() === 'mock';

  const handleChooseAvatar = (event: any) => {
    const avatarUrl = event?.detail?.avatarUrl;
    if (avatarUrl) {
      setLoginAvatar(avatarUrl);
    }
  };

  const handleNicknameInput = (event: any) => {
    setLoginNickname(event.detail?.value || '');
  };

  const handleConfirmLogin = async () => {
    if (!loginAvatar || !loginNickname || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedIn = await loginWithWx({ nickname: loginNickname, avatar: loginAvatar });
      if (loggedIn && typeof onSuccess === 'function') {
        onSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMockLogin = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const preset = getMockLoginPreset();
      const loggedIn = await loginWithWx({ nickname: preset.nickname, avatar: preset.avatar });
      if (loggedIn && typeof onSuccess === 'function') {
        onSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) {
    return null;
  }

  const titleText = '社畜没有派对';

  return (
    <View className={styles.overlay} catchMove onClick={onClose}>
      <View className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <View className={styles.header}>
          <View className={styles.logoWrap}>
            <Image className={styles.logo} src={loginLogo} mode="aspectFill" />
          </View>
          <View className={styles.headerText}>
            <Text className={styles.title}>{titleText}</Text>
            <Text className={styles.subtitle}>使用微信头像和昵称登录，方便保留报名记录和档案。</Text>
          </View>
        </View>

        <View className={styles.body}>
          <View className={styles.fieldGroup}>
            <TaroButton className={styles.avatarButton} openType="chooseAvatar" onChooseAvatar={handleChooseAvatar}>
              {loginAvatar ? '已选择微信头像 ✓' : '选择微信头像'}
            </TaroButton>
            <Input
              className={styles.nicknameInput}
              type="nickname"
              value={loginNickname}
              onInput={handleNicknameInput}
              placeholder="点击输入微信昵称"
              placeholderClass={styles.placeholder}
            />
          </View>

          <View className={styles.actions}>
            <Button
              type="primary"
              size="large"
              block
              disabled={!loginAvatar || !loginNickname || isSubmitting}
              loading={isSubmitting}
              onClick={handleConfirmLogin}
            >
              确认登录
            </Button>
            {isMockMode ? (
              <Button type="secondary" size="large" block loading={isSubmitting} onClick={handleMockLogin}>
                使用体验身份登录
              </Button>
            ) : null}
            {onClose ? <Text className={styles.dismissAction} onClick={onClose}>暂不登录，先逛逛</Text> : null}
            <Text className={styles.helperText}>浏览无需登录；报名、发布和保存个人资料时再登录即可。</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default WxLoginModal;
