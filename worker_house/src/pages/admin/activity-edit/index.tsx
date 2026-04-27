import React, { useEffect, useMemo, useState } from 'react';
import { Image, Picker, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Form from '@nutui/nutui-react-taro/dist/es/packages/form/index';
import FormItem from '@nutui/nutui-react-taro/dist/es/packages/formitem/index';
import Input from '@nutui/nutui-react-taro/dist/es/packages/input/index';
import TextArea from '@nutui/nutui-react-taro/dist/es/packages/textarea/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import {
  createAdminActivity,
  fetchAdminActivities,
  updateAdminActivity,
  uploadAdminCoverImage,
} from '@/services/admin';
import type { Activity } from '@/types';
import styles from './index.module.scss';

const toastId = 'admin-activity-edit-toast';

interface ActivityFormState {
  coverImage: string;
  description: string;
  endDate: string;
  endTime: string;
  maxParticipants: string;
  price: string;
  startDate: string;
  startTime: string;
  title: string;
}

const defaultFormState: ActivityFormState = {
  coverImage: '',
  description: '',
  endDate: '',
  endTime: '',
  maxParticipants: '11',
  price: '148',
  startDate: '',
  startTime: '',
  title: '',
};

const AdminActivityEditPage: React.FC = () => {
  const router = useRouter();
  const activityId = router.params.id?.trim() || '';
  const isEditMode = Boolean(activityId);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<ActivityFormState>(defaultFormState);

  const pageTitle = useMemo(() => (isEditMode ? '编辑活动' : '新增活动'), [isEditMode]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: pageTitle });
  }, [pageTitle]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!isEditMode) {
        return;
      }

      const cached = Taro.getStorageSync('worker-house-admin-activity') as Activity | undefined;
      if (cached?.id === activityId) {
        setForm({
          coverImage: cached.coverImage || cached.cover || '',
          description: cached.description || cached.fullDescription || '',
          endDate: cached.endDate || cached.startDate || '',
          endTime: cached.endTime || cached.startTime || '',
          maxParticipants: String(cached.maxParticipants || 11),
          price: String(cached.price || 148),
          startDate: cached.startDate || '',
          startTime: cached.startTime || '',
          title: cached.title || '',
        });
        setLoading(false);
        return;
      }

      try {
        const response = await fetchAdminActivities();
        const current = response.list.find((item) => item.id === activityId);
        if (!current) {
          throw new Error('活动不存在');
        }
        setForm({
          coverImage: current.coverImage || current.cover || '',
          description: current.description || current.fullDescription || '',
          endDate: current.endDate || current.startDate || '',
          endTime: current.endTime || current.startTime || '',
          maxParticipants: String(current.maxParticipants || 11),
          price: String(current.price || 148),
          startDate: current.startDate || '',
          startTime: current.startTime || '',
          title: current.title || '',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '活动数据加载失败';
        Toast.show(toastId, { content: message, icon: 'fail' });
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [activityId, isEditMode]);

  const updateField = (key: keyof ActivityFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleChooseImage = async () => {
    try {
      const result = await Taro.chooseImage({ count: 1, sizeType: ['compressed', 'original'], sourceType: ['album', 'camera'] });
      const filePath = result.tempFilePaths?.[0];
      if (!filePath) {
        return;
      }
      setUploading(true);
      const uploaded = await uploadAdminCoverImage(filePath);
      updateField('coverImage', uploaded.url);
      Toast.show(toastId, { content: '封面已上传', icon: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片上传失败';
      Toast.show(toastId, { content: message, icon: 'fail' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Toast.show(toastId, { content: '活动标题不能为空', icon: 'warn' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        coverImage: form.coverImage,
        description: form.description,
        endDate: form.endDate,
        endTime: form.endTime,
        maxParticipants: Number(form.maxParticipants || 11),
        price: Number(form.price || 0),
        startDate: form.startDate,
        startTime: form.startTime,
        title: form.title,
      };
      const activity = isEditMode
        ? await updateAdminActivity(activityId, payload)
        : await createAdminActivity(payload);
      Taro.setStorageSync('worker-house-admin-activity', activity);
      Toast.show(toastId, { content: isEditMode ? '活动已更新' : '活动已创建', icon: 'success' });
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
        <Text className={styles.title}>{pageTitle}</Text>
        <Text className={styles.description}>最小表单只保留标题、时间、地点、价格、人数和封面，其他字段由 BFF 自动补默认值。</Text>
      </View>

      <Form className={styles.formCard}>
        <FormItem label="标题">
          <Input value={form.title} placeholder="请输入活动标题" onChange={(value) => updateField('title', value)} />
        </FormItem>
        <FormItem label="活动简介">
          <TextArea value={form.description} placeholder="可选，简单写下活动亮点" onChange={(value) => updateField('description', value)} />
        </FormItem>
        <FormItem label="开始日期">
          <Picker mode="date" value={form.startDate} onChange={(event) => updateField('startDate', event.detail.value)}>
            <View className={styles.pickerValue}>{form.startDate || '请选择开始日期'}</View>
          </Picker>
        </FormItem>
        <FormItem label="开始时间">
          <Picker mode="time" value={form.startTime} onChange={(event) => updateField('startTime', event.detail.value)}>
            <View className={styles.pickerValue}>{form.startTime || '请选择开始时间'}</View>
          </Picker>
        </FormItem>
        <FormItem label="结束日期">
          <Picker mode="date" value={form.endDate} onChange={(event) => updateField('endDate', event.detail.value)}>
            <View className={styles.pickerValue}>{form.endDate || '请选择结束日期'}</View>
          </Picker>
        </FormItem>
        <FormItem label="结束时间">
          <Picker mode="time" value={form.endTime} onChange={(event) => updateField('endTime', event.detail.value)}>
            <View className={styles.pickerValue}>{form.endTime || '请选择结束时间'}</View>
          </Picker>
        </FormItem>
        <FormItem label="价格">
          <Input value={form.price} type="number" placeholder="请输入价格" onChange={(value) => updateField('price', value)} />
        </FormItem>
        <FormItem label="人数上限">
          <Input value={form.maxParticipants} type="number" placeholder="请输入人数上限" onChange={(value) => updateField('maxParticipants', value)} />
        </FormItem>
        <FormItem label="封面图片">
          <View className={styles.coverBlock}>
            {form.coverImage ? <Image className={styles.coverPreview} src={form.coverImage} mode="aspectFill" /> : <View className={styles.coverPlaceholder}>待上传封面</View>}
            <Button type="primary" loading={uploading} onClick={() => void handleChooseImage()}>{uploading ? '上传中…' : '上传 / 更换封面'}</Button>
          </View>
        </FormItem>
      </Form>

      <View className={styles.footerActions}>
        <Button type="primary" loading={saving || loading} onClick={() => void handleSubmit()}>{saving ? '保存中…' : '保存活动'}</Button>
        <Button onClick={() => Taro.navigateBack()}>取消</Button>
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminActivityEditPage;
