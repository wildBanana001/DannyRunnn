import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import { fetchCardUsageLogs, fetchCurrentCardOrder, purchaseCardOrder } from '@/services/member';
import { useCardPackages } from '@/shared/siteConfig';
import type { CardOrder, CardPackage, CardUsageLog } from '@/types';
import { formatDateTime, formatPrice } from '@/utils/helpers';
import styles from './index.module.scss';

const MyCardsPage: React.FC = () => {
  const [currentCard, setCurrentCard] = useState<CardOrder | null>(null);
  const [usageLogs, setUsageLogs] = useState<CardUsageLog[]>([]);
  const cardPackages = useCardPackages();
  const [isPurchasingPackageId, setIsPurchasingPackageId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [cardOrder, logs] = await Promise.all([fetchCurrentCardOrder(), fetchCardUsageLogs()]);
      setCurrentCard(cardOrder);
      setUsageLogs(logs);
    } catch (error) {
      console.warn('[my-cards] load failed', error);
      Taro.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
    }
  }, []);

  useDidShow(() => {
    void loadData();
  });

  const firstPackage = useMemo(() => cardPackages[0] || null, [cardPackages]);

  const handlePurchase = async (cardPackage: CardPackage) => {
    setIsPurchasingPackageId(cardPackage.id);
    try {
      await purchaseCardOrder(cardPackage.id);
      Taro.showToast({ title: '购买成功，次卡已到账', icon: 'success' });
      await loadData();
    } catch (error) {
      console.warn('[my-cards] purchase failed', error);
      Taro.showToast({ title: '购买失败，请先确认已创建档案', icon: 'none' });
    } finally {
      setIsPurchasingPackageId('');
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      {currentCard ? (
        <View className={styles.banner}>
          <Text className={styles.bannerKicker}>worker house</Text>
          <Text className={styles.bannerTitle}>{currentCard.cardType}</Text>
          <Text className={styles.bannerDesc}>绑定档案：{currentCard.userNickname || '未命名档案'} · 购买于 {formatDateTime(currentCard.purchasedAt)}</Text>
          <View className={styles.bannerStats}>
            <View className={styles.statItem}><Text className={styles.statValue}>{currentCard.remainingCount}</Text><Text className={styles.statLabel}>剩余次数</Text></View>
            <View className={styles.statItem}><Text className={styles.statValue}>{currentCard.usedCount}</Text><Text className={styles.statLabel}>已用次数</Text></View>
            <View className={styles.statItem}><Text className={styles.statValue}>{formatPrice(currentCard.amount)}</Text><Text className={styles.statLabel}>累计购买</Text></View>
          </View>
        </View>
      ) : (
        <View className={styles.emptyCardWrap}>
          <EmptyState title="你还没有社畜次卡" description="买一张放着，报名时就能直接抵扣啦。" />
        </View>
      )}

      <View className={styles.sectionCard}>
        <Text className={styles.sectionTitle}>购买区</Text>
        <Text className={styles.sectionDesc}>套餐列表已改为后台下发，购买成功后会自动刷新当前次卡状态。</Text>
        {cardPackages.length > 0 ? cardPackages.map((cardPackage) => (
          <View key={cardPackage.id} className={styles.purchaseCard}>
            <View>
              <Text className={styles.purchaseTitle}>{cardPackage.name}</Text>
              <Text className={styles.purchaseDesc}>有效期 {cardPackage.validDays} 天，每次最高抵扣 {formatPrice(cardPackage.perUseMaxOffset)}。</Text>
            </View>
            <View>
              <Text className={styles.purchasePrice}>{formatPrice(cardPackage.price)}</Text>
              <Button
                type="primary"
                size="medium"
                loading={isPurchasingPackageId === cardPackage.id}
                disabled={Boolean(isPurchasingPackageId)}
                onClick={() => handlePurchase(cardPackage)}
              >
                立即购买
              </Button>
            </View>
          </View>
        )) : <Text className={styles.sectionDesc}>当前暂无可售套餐，请稍后再试。</Text>}
      </View>

      <View className={styles.sectionCard}>
        <Text className={styles.sectionTitle}>说明</Text>
        <Text className={styles.noteText}>1. 支持次卡的活动才会开放开关；不支持时确认订单页会直接提示禁用。</Text>
        <Text className={styles.noteText}>2. 每次报名最多抵扣 {formatPrice(firstPackage?.perUseMaxOffset || 148)}，如果活动低于这个金额，就按活动实际价格抵扣。</Text>
        <Text className={styles.noteText}>3. 次卡一旦用于报名，会自动扣减 1 次并写入下方使用记录。</Text>
      </View>

      <View className={styles.sectionCard}>
        <Text className={styles.sectionTitle}>使用记录</Text>
        {usageLogs.length > 0 ? (
          <View className={styles.logList}>
            {usageLogs.map((log) => (
              <View key={log.id} className={styles.logItem}>
                <View>
                  <Text className={styles.logTitle}>{log.activityTitle}</Text>
                  <Text className={styles.logMeta}>{formatDateTime(log.usedAt)}</Text>
                  <Text className={styles.logMeta}>{log.operatorName} · {log.status === 'used' ? '已使用' : '已回退'} · 抵扣 {log.deductionCount} 次</Text>
                  {log.note ? <Text className={styles.logMeta}>{log.note}</Text> : null}
                </View>
                <Text className={styles.logPrice}>- {formatPrice(log.deductionAmount)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className={styles.sectionDesc}>还没有使用记录，等你下一次报名来刷新这里。</Text>
        )}
      </View>

      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default MyCardsPage;
