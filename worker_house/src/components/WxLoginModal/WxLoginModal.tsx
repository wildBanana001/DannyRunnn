import React, { useState } from 'react';
import { Button as TaroButton, Input, Text, View, Image } from '@tarojs/components';
import Button from '@/components/Button';
import { siteConfig } from '@/data/site';
import { useUserStore } from '@/store/userStore';
import styles from './WxLoginModal.module.scss';

interface WxLoginModalProps {
  visible: boolean;
  onSuccess?: () => void;
}

const WxLoginModal: React.FC<WxLoginModalProps> = ({ visible, onSuccess }) => {
  const loginWithWx = useUserStore((state) => state.loginWithWx);
  const [loginNickname, setLoginNickname] = useState('');
  const [loginAvatar, setLoginAvatar] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await loginWithWx({ nickname: loginNickname, avatar: loginAvatar });
      if (typeof onSuccess === 'function') {
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
    <View className={styles.overlay} catchMove>
      <View className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <View className={styles.header}>
          <View className={styles.logoWrap}>
            <Image className={styles.logo} src={siteConfig.ownerAvatar} mode="aspectFill" />
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
            <Text className={styles.helperText}>登录成功后即可查看活动、报名记录和个人档案。</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default WxLoginModal;
