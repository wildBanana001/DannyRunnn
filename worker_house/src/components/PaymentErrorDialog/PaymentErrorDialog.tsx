import React, { useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@/components/Button';
import styles from './PaymentErrorDialog.module.scss';

interface PaymentErrorDialogProps {
  message: string;
  onClose: () => void;
  visible: boolean;
}

const PaymentErrorDialog: React.FC<PaymentErrorDialogProps> = ({ message, onClose, visible }) => {
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    if (!message || copying) return;
    setCopying(true);
    try {
      await Taro.setClipboardData({ data: message });
      Taro.showToast({ title: '诊断信息已复制', icon: 'success' });
    } catch {
      Taro.showToast({ title: '复制失败，请长按文字复制', icon: 'none' });
    } finally {
      setCopying(false);
    }
  };

  if (!visible) return null;

  return (
    <View className={styles.overlay} catchMove onClick={onClose}>
      <View className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <View className={styles.header}>
          <Text className={styles.eyebrow}>PAYMENT DIAGNOSTIC</Text>
          <Text className={styles.title}>支付暂未完成</Text>
          <Text className={styles.hint}>下方为完整错误信息，可滚动查看或复制后发给开发人员。</Text>
        </View>

        <ScrollView className={styles.messageScroll} scrollY enhanced showScrollbar>
          <Text className={styles.message} userSelect>{message}</Text>
        </ScrollView>

        <View className={styles.actions}>
          <Button block type="primary" onClick={handleCopy}>{copying ? '复制中…' : '复制诊断'}</Button>
          <Button block type="outline" onClick={onClose}>关闭</Button>
        </View>
      </View>
    </View>
  );
};

export default PaymentErrorDialog;
