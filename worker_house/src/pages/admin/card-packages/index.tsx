import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { deleteAdminCardPackage, fetchAdminCardPackages } from '@/services/admin';
import type { CardPackage } from '@/types';
import { formatPrice } from '@/utils/helpers';
import styles from '../shared.module.scss';

const toastId = 'admin-card-packages-toast';

const AdminCardPackagesPage: React.FC = () => {
  const [records, setRecords] = useState<CardPackage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAdminCardPackages();
      setRecords(result.list);
    } catch (error) {
      const message = error instanceof Error ? error.message : '次卡套餐加载失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '次卡套餐' });
    void loadPackages();
  }, [loadPackages]);

  const handleArchive = async (record: CardPackage) => {
    const result = await Taro.showModal({
      title: '归档次卡套餐',
      content: `确认归档「${record.name}」吗？`,
      confirmColor: '#E60000',
    });
    if (!result.confirm) {
      return;
    }

    try {
      await deleteAdminCardPackage(record.id);
      Toast.show(toastId, { content: '套餐已归档', icon: 'success' });
      await loadPackages();
    } catch (error) {
      const message = error instanceof Error ? error.message : '归档失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <Text className={styles.title}>次卡套餐</Text>
        <Text className={styles.description}>维护公开售卖的次卡套餐；删除动作会做软删，保留历史订单兼容性。</Text>
        <View className={styles.actionRow}>
          <Button type="primary" onClick={() => Taro.navigateTo({ url: '/pages/admin/card-package-edit/index' })}>新增套餐</Button>
          <Button onClick={() => void loadPackages()}>{loading ? '刷新中…' : '刷新列表'}</Button>
        </View>
      </View>

      <View className={styles.listCard}>
        {loading ? (
          <Text className={styles.emptyText}>次卡套餐加载中…</Text>
        ) : records.length === 0 ? (
          <Text className={styles.emptyText}>暂无次卡套餐。</Text>
        ) : (
          records.map((item) => (
            <View key={item.id} className={styles.itemBlock}>
              <Text className={styles.itemTitle}>{item.name}</Text>
              <Text className={styles.itemMeta}>状态：{item.status === 'active' ? '生效中' : '已归档'} · 排序：{item.sortOrder}</Text>
              <Text className={styles.itemSummary}>售价 {formatPrice(item.price)} · 总次数 {item.totalCount} · 单次最高抵扣 {formatPrice(item.perUseMaxOffset)} · 有效期 {item.validDays} 天</Text>
              <View className={styles.itemActions}>
                <Button type="primary" onClick={() => {
                  Taro.setStorageSync('worker-house-admin-card-package', item);
                  Taro.navigateTo({ url: `/pages/admin/card-package-edit/index?id=${item.id}` });
                }}>编辑</Button>
                {item.status === 'active' ? <Button onClick={() => void handleArchive(item)}>归档</Button> : null}
              </View>
            </View>
          ))
        )}
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminCardPackagesPage;
