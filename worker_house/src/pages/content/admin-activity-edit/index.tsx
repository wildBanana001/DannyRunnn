import React, { useEffect, useRef, useState } from 'react';
import { Image, Input, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import { useViewportLayout } from '@/hooks/useViewportLayout';
import { fetchAdminIdentity } from '@/services/adminFulfillment';
import { fetchAdminActivity, importActivity, saveAdminActivity, uploadActivityCover } from '@/services/adminActivity';
import type { ActivityEditorForm, AdminActivity } from '@/types/adminActivity';
import { activityToForm, buildActivityPayload, emptyActivityForm, importedActivityForm } from '@/utils/adminActivity';
import styles from './index.module.scss';

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  maxLength?: number;
  onChange: (value: string) => void;
}

function Field({ label, value, placeholder, multiline, numeric, maxLength = 200, onChange }: FieldProps) {
  return <View className={styles.field}>
    <Text className={styles.label}>{label}</Text>
    {multiline
      ? <Textarea className={styles.textarea} value={value} maxlength={maxLength} placeholder={placeholder} onInput={(event) => onChange(event.detail.value)} />
      : <Input className={styles.input} type={numeric ? 'digit' : 'text'} value={value} maxlength={maxLength} placeholder={placeholder} onInput={(event) => onChange(event.detail.value)} />}
  </View>;
}

function DateTimeField({ label, value, mode, onChange }: { label: string; value: string; mode: 'date' | 'time'; onChange: (value: string) => void }) {
  // The picker needs a valid initial cursor; keep the form empty until confirmation.
  const pickerValue = value || (mode === 'time' ? '12:00' : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10));
  return <View className={styles.field}>
    <Text className={styles.label}>{label}</Text>
    <Picker mode={mode} value={pickerValue} onChange={(event) => onChange(String(event.detail.value))}>
      <View className={`${styles.picker} ${!value ? styles.placeholder : ''}`}>{value || (mode === 'date' ? '选择日期' : '选择时间')}<Text>⌄</Text></View>
    </Picker>
  </View>;
}

export default function AdminActivityEditPage(): React.ReactElement {
  const id = useRouter().params.id?.trim();
  const viewportStyle = useViewportLayout();
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [form, setForm] = useState<ActivityEditorForm>(emptyActivityForm);
  const [original, setOriginal] = useState<AdminActivity | null>(null);
  const [content, setContent] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState(false);
  const cacheKey = useRef('');
  const saving = useRef(false);
  const saved = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    void (async () => {
      try {
        const identity = await fetchAdminIdentity();
        if (cancelled) return;
        if (!identity.isAdmin) { setState('forbidden'); return; }
        if (id) {
          const activity = await fetchAdminActivity(id);
          if (cancelled) return;
          setOriginal(activity); setForm(activityToForm(activity));
        } else {
          cacheKey.current = `admin-activity-draft:v1:${identity.openid}`;
          let cached: Partial<ActivityEditorForm> | undefined;
          try { cached = Taro.getStorageSync<Partial<ActivityEditorForm>>(cacheKey.current); } catch { /* Local drafts are optional. */ }
          if (cached && typeof cached === 'object') {
            const restored = emptyActivityForm();
            for (const key of Object.keys(restored) as Array<keyof ActivityEditorForm>) {
              if (typeof cached[key] === 'string') restored[key] = cached[key] as string;
            }
            setForm(restored);
            if (restored.title || restored.fullDescription) setNotice('已恢复上次未发布的本机草稿。');
          }
        }
        setState('ready');
      } catch (cause) {
        if (!cancelled) { setError(cause instanceof Error ? cause.message : '活动加载失败'); setState('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [id, retry]);

  useEffect(() => {
    if (id || state !== 'ready' || !cacheKey.current || saved.current) return;
    const timeout = setTimeout(() => {
      try { Taro.setStorageSync(cacheKey.current, form); } catch { /* Editing remains available if device storage is full. */ }
    }, 400);
    return () => clearTimeout(timeout);
  }, [form, id, state]);

  const update = (key: keyof ActivityEditorForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const returnToAdmin = () => {
    const pages = Taro.getCurrentPages();
    const previous = pages[pages.length - 2];
    if (previous?.route?.replace(/^\//, '') === 'pages/content/admin-activities/index') {
      void Taro.navigateBack();
    } else {
      void Taro.redirectTo({ url: '/pages/content/admin-activities/index' });
    }
  };

  const generate = async () => {
    if (busy || !content.trim()) return;
    if (form.title || form.fullDescription) {
      const answer = await Taro.showModal({ title: '重新生成草稿', content: '新推文会替换当前编辑内容，是否继续？', confirmText: '重新生成' });
      if (!answer.confirm) return;
    }
    setBusy('import'); setError(''); setImportError(''); setNotice('');
    try {
      const result = await importActivity(content.trim());
      setForm(importedActivityForm(result)); setWarnings(result.warnings); setPreview(false);
      setNotice('草稿已生成，请核对时间、单价和名额后再发布。');
      Taro.showToast({ title: '草稿已生成', icon: 'success' });
    } catch (cause) { setImportError(cause instanceof Error ? cause.message : '推文导入失败'); }
    finally { setBusy(''); }
  };

  const paste = async () => {
    try { const result = await Taro.getClipboardData(); setContent(result.data); }
    catch { setImportError('暂时无法读取剪贴板，请长按输入框粘贴。'); }
  };

  const upload = async () => {
    if (busy) return;
    setBusy('upload'); setError('');
    try { update('coverImage', await uploadActivityCover()); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : String((cause as { errMsg?: string })?.errMsg || '图片上传失败');
      if (!message.toLowerCase().includes('cancel')) setError(message);
    } finally { setBusy(''); }
  };

  const save = async (enabled: boolean) => {
    if (busy || saving.current) return;
    setError('');
    let payload: ReturnType<typeof buildActivityPayload>;
    try { payload = buildActivityPayload(form, enabled); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '请检查活动信息'); return; }
    saving.current = true;
    try {
      const answer = await Taro.showModal({
        title: enabled ? original?.enabled ? '确认更新活动' : '确认发布活动' : '保存未发布活动',
        content: `${form.title}\n${form.startDate} ${form.startTime} 至 ${form.endDate} ${form.endTime}\n单价 ¥${payload.price.toFixed(2)} / 人，名额 ${payload.maxParticipants} 人。\n${enabled ? '确认后将同步展示在活动列表。' : '仅管理员可见，之后可继续编辑发布。'}`,
        confirmText: enabled ? '确认发布' : '确认保存',
      });
      if (!answer.confirm) return;
      setBusy('save');
      const result = await saveAdminActivity(id, {
        ...payload,
        ...(!id ? { originalPrice: payload.price, currentParticipants: 0, cardEligible: false, tags: [], requirements: [], includes: [] } : {}),
      });
      saved.current = true;
      try { if (cacheKey.current) Taro.removeStorageSync(cacheKey.current); } catch { /* A saved server record must still be reported as successful. */ }
      Taro.showToast({ title: enabled ? '活动已发布' : '已保存', icon: 'success' });
      if (!id) {
        Taro.redirectTo({ url: `/pages/content/admin-activity-edit/index?id=${encodeURIComponent(result.id)}` });
      } else {
        setOriginal(result); setForm(activityToForm(result)); setNotice(enabled ? '修改已同步到活动列表。' : '已保存为未发布活动。');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试'); }
    finally { saving.current = false; setBusy(''); }
  };

  if (state === 'forbidden') return <View className={styles.state} style={viewportStyle}><EmptyState title="仅管理员可访问" description="请使用已加入管理员白名单的微信账号。" /></View>;
  if (state === 'loading') return <View className={styles.state} style={viewportStyle}><Text>正在准备活动编辑器…</Text></View>;
  if (state === 'error') return <View className={styles.state} style={viewportStyle}><EmptyState title="暂时无法打开活动" description={error}><Button onClick={() => setRetry((value) => value + 1)}>重试</Button></EmptyState></View>;

  return (
    <View className={styles.page} style={viewportStyle}>
      <ScrollView scrollY className={styles.scroll}>
        <View className={styles.header}>
          <Text className={styles.eyebrow}>ACTIVITY STUDIO</Text>
          <Text className={styles.heading}>{id ? '编辑活动' : '创建下一场相聚'}</Text>
          <Text className={styles.muted}>{original?.enabled ? '当前已上架，保存修改后同步更新。' : '导入推文 · 核对信息 · 发布活动'}</Text>
        </View>
        {!id ? <View className={styles.card}>
          <Text className={styles.sectionTitle}>01 / 粘贴推文正文</Text>
          <Textarea className={styles.importArea} value={content} maxlength={20000} placeholder="把复制出来的推文正文粘贴到这里。包含活动时间、地点、费用和人数，方便生成草稿。" onInput={(event) => setContent(event.detail.value)} />
          <View className={styles.importActions}><Button size="small" type="outline" disabled={Boolean(busy)} onClick={() => void paste()}>从剪贴板粘贴</Button><Button size="small" loading={busy === 'import'} disabled={Boolean(busy) || !content.trim()} onClick={() => void generate()}>生成活动草稿</Button></View>
          {importError ? <View className={styles.error}><Text>{importError}</Text></View> : null}
          <Text className={styles.hint}>支持最多 20000 字。生成草稿后，请补充封面并核对活动信息。</Text>
        </View> : null}
        {notice ? <Text className={styles.notice}>{notice}</Text> : null}
        {warnings.length ? <View className={styles.warning}><Text className={styles.label}>导入提示，请在下方补充或核对</Text>{warnings.map((warning) => <Text className={styles.warningLine} key={warning}>· {warning}</Text>)}</View> : null}
        <View className={styles.card}>
          <View className={styles.sectionRow}><Text className={styles.sectionTitle}>{id ? '活动信息' : '02 / 核对与编辑'}</Text><Button className={styles.compactButton} size="small" type="ghost" onClick={() => setPreview(!preview)}>{preview ? '继续编辑' : '预览内容'}</Button></View>
          {preview ? <View className={styles.preview}>
            {form.coverImage ? <Image className={styles.previewCover} src={form.coverImage} mode="aspectFill" /> : <View className={styles.coverPlaceholder}>待添加封面</View>}
            <Text className={styles.previewTitle}>{form.title || '活动标题待填写'}</Text>
            <Text className={styles.muted}>{form.startDate || '日期待填写'} {form.startTime} — {form.endDate} {form.endTime}</Text>
            <Text className={styles.previewPrice}>{form.price === '' ? '价格待填写' : `¥${form.price} / 人`} · {form.maxParticipants || '—'} 个名额</Text>
            <Text className={styles.muted}>{form.location || '地点待填写'} {form.address}</Text>
            <Text className={styles.previewBody}>{form.fullDescription || '正文待填写'}</Text>
            {form.gallery.split('\n').map((url) => url.trim()).filter((url) => url && url !== form.coverImage).map((url, index) => <Image key={`${url}-${index}`} className={styles.galleryImage} src={url} mode="widthFix" />)}
          </View> : <>
            <Field label="活动标题 *" value={form.title} placeholder="给这场活动起个名字" maxLength={100} onChange={(value) => update('title', value)} />
            <Field label="一句话简介 *" value={form.description} placeholder="会出现在活动卡片上" maxLength={300} onChange={(value) => update('description', value)} />
            <View className={styles.field}><Text className={styles.label}>活动封面 *</Text>{form.coverImage ? <Image className={styles.cover} src={form.coverImage} mode="aspectFill" /> : <View className={styles.coverPlaceholder}>选择一张能代表活动的图片</View>}<Button size="small" type="outline" loading={busy === 'upload'} disabled={Boolean(busy)} onClick={() => void upload()}>上传 / 更换封面</Button></View>
            <Field label="或填写封面图片链接" value={form.coverImage} placeholder="https://…" maxLength={2048} onChange={(value) => update('coverImage', value)} />
            <View className={styles.grid}><DateTimeField label="开始日期 *" mode="date" value={form.startDate} onChange={(value) => { update('startDate', value); if (!form.endDate) update('endDate', value); }} /><DateTimeField label="开始时间 *" mode="time" value={form.startTime} onChange={(value) => update('startTime', value)} /><DateTimeField label="结束日期 *" mode="date" value={form.endDate} onChange={(value) => update('endDate', value)} /><DateTimeField label="结束时间 *" mode="time" value={form.endTime} onChange={(value) => update('endTime', value)} /></View>
            <View className={styles.grid}><Field label="单价（元 / 人）*" numeric value={form.price} placeholder="免费填 0" onChange={(value) => update('price', value)} /><Field label="人数上限 *" numeric value={form.maxParticipants} placeholder="例如 20" onChange={(value) => update('maxParticipants', value)} /></View>
            <Field label="活动地点 *" value={form.location} placeholder="例如：社畜之家" onChange={(value) => update('location', value)} />
            <Field label="详细地址" value={form.address} maxLength={300} onChange={(value) => update('address', value)} />
            <View className={styles.grid}><Field label="活动分类 *" value={form.category} maxLength={40} onChange={(value) => update('category', value)} /><Field label="主理人" value={form.hostName} maxLength={80} onChange={(value) => update('hostName', value)} /></View>
            <Field label="活动正文 *" multiline value={form.fullDescription} maxLength={20000} onChange={(value) => update('fullDescription', value)} />
            <Field label="详情图片" multiline value={form.gallery} maxLength={24000} placeholder="每行一个 HTTPS 图片链接，可删除不需要的配图" onChange={(value) => update('gallery', value)} />
            <Field label="退款说明" multiline value={form.refundPolicy} maxLength={1000} placeholder="填写本场活动的退款规则" onChange={(value) => update('refundPolicy', value)} />
          </>}
        </View>
        {error ? <View className={styles.error}><Text>{error}</Text></View> : null}
        <View className={styles.saveArea}>
          <Text className={styles.hint}>{!id ? '编辑内容会暂存在本机；补齐必填项后可保存或发布。' : '请核对信息，已有报名和订单不会被清除。'}</Text>
          {!original?.enabled ? <Button block type="outline" disabled={Boolean(busy)} onClick={() => void save(false)}>保存为未发布</Button> : null}
          <Button block loading={busy === 'save'} disabled={Boolean(busy)} onClick={() => void save(true)}>{original?.enabled ? '保存并更新活动' : '发布活动'}</Button>
          <Button block type="ghost" disabled={Boolean(busy)} onClick={returnToAdmin}>返回管理后台</Button>
        </View>
      </ScrollView>
    </View>
  );
}
