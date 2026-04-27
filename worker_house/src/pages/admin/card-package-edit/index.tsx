import React, { useEffect, useMemo, useState } from 'react';
import { Picker, ScrollView, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Form from '@nutui/nutui-react-taro/dist/es/packages/form/index';
import FormItem from '@nutui/nutui-react-taro/dist/es/packages/formitem/index';
import Input from '@nutui/nutui-react-taro/dist/es/packages/input/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import { createAdminCardPackage, fetchAdminCardPackages, updateAdminCardPackage } from '@/services/admin';
import type { CardPackage, CardPackageStatus } from '@/types';
import styles from '../shared.module.scss';

const toastId = 'admin-card-package-edit-toast';
const storageKey = 'worker-house-admin-card-package';

interface CardPackageFormState {
  name: string;
  totalCount: string;
  price: string;
  perUseMaxOffset: string;
  validDays: string;
  sortOrder: string;
  status: CardPackageStatus;
}

const defaultFormState: CardPackageFormState = {
  name: '',
  totalCount: '3',
  price: '399',
  perUseMaxOffset: '148',
  validDays: '180',
  sortOrder: '1',
  status: 'active',
};

const statusOptions: Array<{ label: string; value: CardPackageStatus }> = [
  { label: '生效中', value: 'active' },
  { label: '已归档', value: 'archived' },
];

const buildFormState = (record?: CardPackage): CardPackageFormState => ({
  name: record?.name || '',
  totalCount: String(record?.totalCount || 3),
  price: String(record?.price || 399),
  perUseMaxOffset: String(record?.perUseMaxOffset || 148),
  validDays: String(record?.validDays || 180),
  sortOrder: String(record?.sortOrder || 1),
  status: record?.status || 'active',
});

const AdminCardPackageEditPage: React.FC = () => {
  const router = useRouter();
  const packageId = router.params.id?.trim() || '';
  const isEditMode = Boolean(packageId);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CardPackageFormState>(defaultFormState);

  const statusIndex = Math.max(statusOptions.findIndex((item) => item.value === form.status), 0);
  const pageTitle = useMemo(() => (isEditMode ? '编辑次卡套餐' : '新增次卡套餐'), [isEditMode]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: pageTitle });
  }, [pageTitle]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!isEditMode) {
        return;
      }
      const cached = Taro.getStorageSync(storageKey) as CardPackage | undefined;
      if (cached?.id === packageId) {
        setForm(buildFormState(cached));
        setLoading(false);
        return;
      }
      try {
        const result = await fetchAdminCardPackages();
        const current = result.list.find((item) => item.id === packageId);
        if (!current) {
          throw new Error('次卡套餐不存在');
        }
        setForm(buildFormState(current));
      } catch (error) {
        const message = error instanceof Error ? error.message : '次卡套餐数据加载失败';
        Toast.show(toastId, { content: message, icon: 'fail' });
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [isEditMode, packageId]);

  const updateField = (key: keyof CardPackageFormState, value: string | CardPackageStatus) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Toast.show(toastId, { content: '套餐名称不能为空', icon: 'warn' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        perUseMaxOffset: Number(form.perUseMaxOffset || 0),
        price: Number(form.price || 0),
        sortOrder: Number(form.sortOrder || 1),
        status: form.status,
        totalCount: Number(form.totalCount || 0),
        validDays: Number(form.validDays || 0),
      };
      const record = isEditMode
        ? await updateAdminCardPackage(packageId, payload)
        : await createAdminCardPackage(payload);
      Taro.setStorageSync(storageKey, record);
      Toast.show(toastId, { content: isEditMode ? '次卡套餐已更新' : '次卡套餐已创建', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 300);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className={styles.container} scrollY enableFlex>
      <View className={styles.headerCard}>
        <View>
          <View className={styles.title}>{pageTitle}</View>
          <View className={styles.description}>配置售卖价格、总次数、单次最高抵扣金额与有效期，保存后会立即影响套餐展示。</View>
        </View>
      </View>

      <Form className={styles.formCard}>
        <FormItem label="套餐名称">
          <Input value={form.name} placeholder="请输入套餐名称" onChange={(value) => updateField('name', value)} />
        </FormItem>
        <FormItem label="总次数">
          <Input value={form.totalCount} type="number" placeholder="请输入总次数" onChange={(value) => updateField('totalCount', value)} />
        </FormItem>
        <FormItem label="售价">
          <Input value={form.price} type="number" placeholder="请输入售价" onChange={(value) => updateField('price', value)} />
        </FormItem>
        <FormItem label="单次最高抵扣">
          <Input value={form.perUseMaxOffset} type="number" placeholder="请输入单次最高抵扣" onChange={(value) => updateField('perUseMaxOffset', value)} />
        </FormItem>
        <FormItem label="有效期天数">
          <Input value={form.validDays} type="number" placeholder="请输入有效期天数" onChange={(value) => updateField('validDays', value)} />
        </FormItem>
        <FormItem label="排序">
          <Input value={form.sortOrder} type="number" placeholder="请输入排序" onChange={(value) => updateField('sortOrder', value)} />
        </FormItem>
        <FormItem label="状态">
          <Picker mode="selector" range={statusOptions} rangeKey="label" value={statusIndex} onChange={(event) => updateField('status', statusOptions[event.detail.value]?.value || 'active')}>
            <View className={styles.pickerValue}>{statusOptions[statusIndex]?.label || '生效中'}</View>
          </Picker>
        </FormItem>
      </Form>

      <View className={styles.actionCard}>
        <View className={styles.actionRow}>
          <Button type="primary" loading={saving || loading} onClick={() => void handleSubmit()}>{saving ? '保存中…' : '保存套餐'}</Button>
          <Button onClick={() => Taro.navigateBack()}>取消</Button>
        </View>
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminCardPackageEditPage;
