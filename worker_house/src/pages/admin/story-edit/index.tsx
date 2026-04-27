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
  createAdminStory,
  fetchAdminStories,
  updateAdminStory,
  uploadAdminCoverImage,
  type AdminMiniStory,
} from '@/services/admin';
import styles from './index.module.scss';

const toastId = 'admin-story-edit-toast';
const storyStorageKey = 'worker-house-admin-story';

interface StoryFormState {
  title: string;
  cover: string;
  excerpt: string;
  content: string;
  publishAt: string;
  author: string;
  sourceUrl: string;
}

const defaultFormState: StoryFormState = {
  title: '',
  cover: '',
  excerpt: '',
  content: '',
  publishAt: '',
  author: '',
  sourceUrl: '',
};

const AdminStoryEditPage: React.FC = () => {
  const router = useRouter();
  const storyId = router.params.id?.trim() || '';
  const isEditMode = Boolean(storyId);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<StoryFormState>(defaultFormState);

  const pageTitle = useMemo(() => (isEditMode ? '编辑社畜故事' : '新增社畜故事'), [isEditMode]);

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: pageTitle });
  }, [pageTitle]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!isEditMode) {
        return;
      }

      const cached = Taro.getStorageSync(storyStorageKey) as AdminMiniStory | undefined;
      if (cached?.id === storyId) {
        setForm({
          title: cached.title || '',
          cover: cached.cover || '',
          excerpt: cached.excerpt || '',
          content: cached.content || '',
          publishAt: cached.publishAt ? cached.publishAt.slice(0, 10) : '',
          author: cached.author || '',
          sourceUrl: cached.sourceUrl || '',
        });
        setLoading(false);
        return;
      }

      try {
        const response = await fetchAdminStories();
        const current = response.list.find((item) => item.id === storyId);
        if (!current) {
          throw new Error('故事不存在');
        }
        setForm({
          title: current.title || '',
          cover: current.cover || '',
          excerpt: current.excerpt || '',
          content: current.content || '',
          publishAt: current.publishAt ? current.publishAt.slice(0, 10) : '',
          author: current.author || '',
          sourceUrl: current.sourceUrl || '',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '故事数据加载失败';
        Toast.show(toastId, { content: message, icon: 'fail' });
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [isEditMode, storyId]);

  const updateField = (key: keyof StoryFormState, value: string) => {
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
      updateField('cover', uploaded.url);
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
      Toast.show(toastId, { content: '故事标题不能为空', icon: 'warn' });
      return;
    }
    if (!form.cover.trim()) {
      Toast.show(toastId, { content: '请先上传封面', icon: 'warn' });
      return;
    }
    if (!form.publishAt) {
      Toast.show(toastId, { content: '请选择发布时间', icon: 'warn' });
      return;
    }

    if (form.sourceUrl.trim() && !form.sourceUrl.trim().startsWith('https://mp.weixin.qq.com/')) {
      Toast.show(toastId, { content: '公众号链接必须以 https://mp.weixin.qq.com/ 开头', icon: 'warn' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        cover: form.cover.trim(),
        excerpt: form.excerpt.trim(),
        content: form.content.trim(),
        publishAt: new Date(`${form.publishAt}T00:00:00+08:00`).toISOString(),
        author: form.author.trim(),
        sourceUrl: form.sourceUrl.trim(),
      };
      const story = isEditMode
        ? await updateAdminStory(storyId, payload)
        : await createAdminStory(payload);
      Taro.setStorageSync(storyStorageKey, story);
      Toast.show(toastId, { content: isEditMode ? '故事已更新' : '故事已创建', icon: 'success' });
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
        <Text className={styles.description}>维护故事标题、封面、摘要、正文与原文链接，首页会自动取最近三条展示。</Text>
      </View>

      <Form className={styles.formCard}>
        <FormItem label="标题">
          <Input value={form.title} placeholder="请输入故事标题" onChange={(value) => updateField('title', value)} />
        </FormItem>
        <FormItem label="摘要">
          <TextArea value={form.excerpt} placeholder="请输入 1~2 句摘要" onChange={(value) => updateField('excerpt', value)} />
        </FormItem>
        <FormItem label="正文">
          <TextArea value={form.content} placeholder="请输入故事正文，可直接粘贴多段文本" onChange={(value) => updateField('content', value)} />
        </FormItem>
        <FormItem label="发布时间">
          <Picker mode="date" value={form.publishAt} onChange={(event) => updateField('publishAt', event.detail.value)}>
            <View className={styles.pickerValue}>{form.publishAt || '请选择发布时间'}</View>
          </Picker>
        </FormItem>
        <FormItem label="作者">
          <Input value={form.author} placeholder="可选，填写作者名" onChange={(value) => updateField('author', value)} />
        </FormItem>
        <FormItem label="原文链接">
          <Input value={form.sourceUrl} placeholder="请填写公众号文章链接" onChange={(value) => updateField('sourceUrl', value)} />
        </FormItem>
        <FormItem label="封面图片">
          <View className={styles.coverBlock}>
            {form.cover ? <Image className={styles.coverPreview} src={form.cover} mode="aspectFill" /> : <View className={styles.coverPlaceholder}>待上传封面</View>}
            <Button type="primary" loading={uploading} onClick={() => void handleChooseImage()}>{uploading ? '上传中…' : '上传 / 更换封面'}</Button>
          </View>
        </FormItem>
      </Form>

      <View className={styles.footerActions}>
        <Button type="primary" loading={saving || loading} onClick={() => void handleSubmit()}>{saving ? '保存中…' : '保存故事'}</Button>
        <Button onClick={() => Taro.navigateBack()}>取消</Button>
      </View>

      <Toast id={toastId} />
      <View className={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminStoryEditPage;
