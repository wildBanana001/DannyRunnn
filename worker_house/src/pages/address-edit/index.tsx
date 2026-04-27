import React, { useEffect, useState } from 'react';
import { Input, Switch, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import { fetchAddresses, createAddress, updateAddress } from '@/services/address';
import styles from './index.module.scss';

interface AddressDraft {
  name: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
}

const AddressEditPage: React.FC = () => {
  const router = useRouter();
  const [form, setForm] = useState<AddressDraft>({
    name: '',
    phone: '',
    region: '',
    detail: '',
    isDefault: false
  });
  const isEditing = Boolean(router.params.id);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: isEditing ? '编辑地址' : '新增地址' });
    if (!router.params.id) {
      return;
    }

    const load = async () => {
      try {
        Taro.showLoading({ title: '加载中' });
        const list = await fetchAddresses();
        const currentAddress = list.find((item) => item.id === router.params.id);
        if (currentAddress) {
          setForm({
            name: currentAddress.name,
            phone: currentAddress.phone,
            region: [currentAddress.province, currentAddress.city, currentAddress.district].filter(Boolean).join(' '),
            detail: currentAddress.detail,
            isDefault: currentAddress.isDefault
          });
        }
      } catch (err) {
        console.error(err);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        Taro.hideLoading();
      }
    };
    load();
  }, [isEditing, router.params.id]);

  const updateField = (key: keyof AddressDraft, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.region.trim() || !form.detail.trim()) {
      Taro.showToast({ title: '请先填写完整地址信息', icon: 'none' });
      return;
    }

    const parts = form.region.trim().split(/\s+/);
    const province = parts[0] || '';
    const city = parts[1] || '';
    const district = parts.slice(2).join(' ') || '';

    try {
      Taro.showLoading({ title: '保存中...' });
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        province,
        city,
        district,
        detail: form.detail.trim(),
        isDefault: form.isDefault
      };

      if (isEditing && router.params.id) {
        await updateAddress(router.params.id, payload);
      } else {
        await createAddress(payload);
      }

      Taro.hideLoading();
      Taro.showToast({ title: '地址已保存', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 500);
    } catch (err) {
      console.error(err);
      Taro.hideLoading();
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  };

  return (
    <View className={styles.container}>
      <View className={styles.formCard}>
        <View className={styles.formItem}>
          <Text className={styles.label}>收件人</Text>
          <Input className={styles.input} placeholder="请输入收件人姓名" value={form.name} onInput={(event) => updateField('name', event.detail.value)} />
        </View>
        <View className={styles.formItem}>
          <Text className={styles.label}>电话</Text>
          <Input className={styles.input} type="number" maxlength={11} placeholder="请输入联系电话" value={form.phone} onInput={(event) => updateField('phone', event.detail.value)} />
        </View>
        <View className={styles.formItem}>
          <Text className={styles.label}>省市区</Text>
          <Input className={styles.input} placeholder="例如：上海市 徐汇区 徐家汇街道(以空格分隔)" value={form.region} onInput={(event) => updateField('region', event.detail.value)} />
        </View>
        <View className={styles.formItem}>
          <Text className={styles.label}>详细地址</Text>
          <Input className={styles.input} placeholder="请输入详细门牌信息" value={form.detail} onInput={(event) => updateField('detail', event.detail.value)} />
        </View>
      </View>

      <View className={styles.switchRow}>
        <Text className={styles.label}>设为默认地址</Text>
        <Switch checked={form.isDefault} color="#E60000" onChange={(event) => updateField('isDefault', event.detail.value)} />
      </View>

      <View className={styles.actionBar}>
        <Button type="primary" size="large" block onClick={handleSave}>
          保存地址
        </Button>
      </View>
    </View>
  );
};

export default AddressEditPage;
