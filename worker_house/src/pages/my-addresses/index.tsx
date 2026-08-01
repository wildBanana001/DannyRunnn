import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, type ITouchEvent } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import { fetchAddresses, deleteAddress, type Address } from '@/services/address';
import styles from './index.module.scss';

const MyAddressesPage: React.FC = () => {
  const router = useRouter();
  const isSelecting = router.params.select === '1';
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await fetchAddresses();
      setAddresses(data);
    } catch (err) {
      console.error(err);
      setError(true);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    loadData();
  });

  const handleDelete = async (id: string) => {
    const result = await Taro.showModal({
      title: '删除确认',
      content: '确定要删除该地址吗？',
      confirmColor: '#E60000'
    });

    if (!result.confirm) {
      return;
    }

    try {
      Taro.showLoading({ title: '删除中...' });
      await deleteAddress(id);
      Taro.hideLoading();
      Taro.showToast({ title: '已删除', icon: 'success' });
      loadData();
    } catch (err) {
      console.error(err);
      Taro.hideLoading();
      Taro.showToast({ title: '删除失败', icon: 'none' });
    }
  };

  const handleSelect = (address: Address) => {
    if (!isSelecting) return;
    Taro.eventCenter.trigger('shop:address-selected', address);
    Taro.navigateBack();
  };

  const stopAndRun = (event: ITouchEvent, action: () => void) => {
    event.stopPropagation();
    action();
  };

  if (loading && addresses.length === 0) {
    return (
      <View className={styles.container}>
        <View style={{ textAlign: 'center', marginTop: 100, color: '#999' }}><Text>加载中...</Text></View>
      </View>
    );
  }

  if (error && addresses.length === 0) {
    return (
      <View className={styles.container}>
        <EmptyState title="加载失败" description="请检查网络后重试" />
        <View style={{ padding: '0 32px' }}>
          <Button type="primary" onClick={loadData}>重试</Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.actionHeader}>
        {isSelecting ? <Text className={styles.selectHint}>选择一个地址用于本次订单</Text> : null}
        <Button type="primary" size="medium" onClick={() => Taro.navigateTo({ url: '/pages/address-edit/index' })}>
          添加地址
        </Button>
      </View>

      {addresses.length > 0 ? (
        <View className={styles.list}>
          {addresses.map((address) => (
            <View key={address.id} className={styles.card} onClick={() => handleSelect(address)}>
              <View className={styles.cardHeader}>
                <Text className={styles.name}>{address.name}</Text>
                <Text className={styles.phone}>{address.phone}</Text>
                {address.isDefault ? <View className={styles.defaultTag}><Text className={styles.defaultTagText}>默认</Text></View> : null}
              </View>
              <Text className={styles.addressText}>{`${address.province} ${address.city} ${address.district}`}</Text>
              <Text className={styles.addressText}>{address.detail}</Text>
              <View className={styles.footer}>
                {isSelecting ? <Text className={styles.selectAction}>选择此地址</Text> : null}
                {isSelecting ? <Text className={styles.divider}>·</Text> : null}
                <Text className={styles.actionText} onClick={(event) => stopAndRun(event, () => Taro.navigateTo({ url: `/pages/address-edit/index?id=${address.id}` }))}>编辑</Text>
                <Text className={styles.divider}>·</Text>
                <Text className={styles.deleteText} onClick={(event) => stopAndRun(event, () => handleDelete(address.id))}>删除</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="还没有收货地址" description="先添加一个常用地址，后续报名寄送周边会更方便。" />
      )}

      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default MyAddressesPage;
