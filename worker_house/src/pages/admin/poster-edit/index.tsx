import React, { useEffect, useMemo, useState } from 'react';
import { Image, Picker, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@nutui/nutui-react-taro/dist/es/packages/button/index';
import Form from '@nutui/nutui-react-taro/dist/es/packages/form/index';
import FormItem from '@nutui/nutui-react-taro/dist/es/packages/formitem/index';
import Input from '@nutui/nutui-react-taro/dist/es/packages/input/index';
import Toast from '@nutui/nutui-react-taro/dist/es/packages/toast/index';
import '@nutui/nutui-react-taro/dist/style.css';
import {
  createAdminPoster,
  fetchAdminPosters,
  updateAdminPoster,
  uploadAdminCoverImage,
  type AdminMiniPoster,
  type AdminPosterStatus,
} from '@/services/admin';
import styles from './index.module.scss';

const toastId = 'admin-poster-edit-toast';
const posterStorageKey = 'worker-house-admin-poster';

const statusOptions: Array<{ label: string; value: AdminPosterStatus }> = [
  { label: '上架', value: 'online' },
  { label: '下架', value: 'offline' },
];

interface PosterFormState {
  title: string;
  coverImage: string;
  linkUrl: string;
  relatedActivityId: string;
  status: AdminPosterStatus;
}

const defaultFormState: PosterFormState = {
  title: '',
  coverImage: '',
  linkUrl: '',
  relatedActivityId: '',
  status: 'online',
};

const AdminPosterEditPage: React.FC = () => {
  const router = useRouter();
  const posterId = router.params.id?.trim() || '';
  const isEditMode = Boolean(posterId);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<PosterFormState>(defaultFormState);

  const pageTitle = useMemo(() => (isEditMode ? '编辑海报' : '新增海报'), [isEditMode]);
  const selectedStatusLabel = useMemo(
    () => statusOptions.find((item) => item.value === form.status)?.label || '请选择状态',
    [form.status],
  );

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: pageTitle });
  }, [pageTitle]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!isEditMode) {
        return;
      }

      const cached = Taro.getStorageSync(posterStorageKey) as AdminMiniPoster | undefined;
      if (cached?.id === posterId) {
        setForm({
          title: cached.title || '',
          coverImage: cached.coverImage || '',
          linkUrl: cached.linkUrl || '',
          relatedActivityId: cached.relatedActivityId || '',
          status: cached.status || 'online',
        });
        setLoading(false);
        return;
      }

      try {
        const response = await fetchAdminPosters();
        const current = response.list.find((item) => item.id === posterId);
        if (!current) {
          throw new Error('海报不存在');
        }
        setForm({
          title: current.title || '',
          coverImage: current.coverImage || '',
          linkUrl: current.linkUrl || '',
          relatedActivityId: current.relatedActivityId || '',
          status: current.status || 'online',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '海报数据加载失败';
        Toast.show(toastId, { content: message, icon: 'fail' });
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [isEditMode, posterId]);

  const updateField = (key: keyof PosterFormState, value: string) => {
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
      Toast.show(toastId, { content: '海报标题不能为空', icon: 'warn' });
      return;
    }
    if (!form.coverImage.trim()) {
      Toast.show(toastId, { content: '请先上传封面', icon: 'warn' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        coverImage: form.coverImage.trim(),
        linkUrl: form.linkUrl.trim(),
        relatedActivityId: form.relatedActivityId.trim(),
        status: form.status,
      };
      const poster = isEditMode
        ? await updateAdminPoster(posterId, payload)
        : await createAdminPoster(payload);
      Taro.setStorageSync(posterStorageKey, poster);
      Toast.show(toastId, { content: isEditMode ? '海报已更新' : '海报已创建', icon: 'success' });
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
        <Text className={styles.description}>字段压缩为标题、封面、跳转链接、关联活动 ID 与上架状态，适合手机端快速维护。</Text>
      </View>

      <Form className={styles.formCard}>
        <FormItem label="标题">
          <Input value={form.title} placeholder="请输入海报标题" onChange={(value) => updateField('title', value)} />
        </FormItem>
        <FormItem label="跳转链接">
          <Input value={form.linkUrl} placeholder="可选，填写海报跳转链接" onChange={(value) => updateField('linkUrl', value)} />
        </FormItem>
        <FormItem label="关联活动 ID">
          <Input value={form.relatedActivityId} placeholder="可选，填写活动 ID" onChange={(value) => updateField('relatedActivityId', value)} />
        </FormItem>
        <FormItem label="上架状态">
          <Picker
            mode="selector"
            range={statusOptions.map((item) => item.label)}
            value={statusOptions.findIndex((item) => item.value === form.status)}
            onChange={(event) => updateField('status', statusOptions[Number(event.detail.value)]?.value || 'online')}
          >
            <View className={styles.pickerValue}>{selectedStatusLabel}</View>
          </Picker>
        </FormItem>
        <FormItem label="封面图片">
          <View className={styles.coverBlock}>
            {form.coverImage ? <Image className={styles.coverPreview} src={form.coverImage} mode="aspectFill" /> : <View className={styles.coverPlaceholder}>待上传封面</View>}
            <Button type="primary" loading={uploading} onClick={() => void handleChooseImage()}>{uploading ? '上传中…' : '上传 / 更换封面'}</Button>
          </View>
        </FormItem>
      </Form>

      <View className={styles.footerActions}>
        <Button type="primary" loading={saving || loading} onClick={() => void handleSubmit()}>{saving ? '保存中…' : '保存海报'}</Button>
        <Button onClick={() => Taro.navigateBack()}>取消</Button>
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminPosterEditPage;
