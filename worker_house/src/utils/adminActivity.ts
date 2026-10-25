import type { ActivityEditorForm, ActivityImportResult, AdminActivity } from '../types/adminActivity';

export function emptyActivityForm(): ActivityEditorForm {
  return {
    title: '', description: '', fullDescription: '', coverImage: '', gallery: '',
    startDate: '', endDate: '', startTime: '', endTime: '', location: '', address: '',
    price: '', maxParticipants: '', category: '社群活动', hostName: '', refundPolicy: '',
  };
}

export function importedActivityForm(result: ActivityImportResult): ActivityEditorForm {
  return {
    ...emptyActivityForm(), ...result.draft,
    gallery: result.draft.gallery.join('\n'),
    price: result.draft.price === null ? '' : String(result.draft.price),
    maxParticipants: result.draft.maxParticipants === null ? '' : String(result.draft.maxParticipants),
  };
}

export function activityToForm(activity: AdminActivity): ActivityEditorForm {
  const form = emptyActivityForm();
  for (const key of Object.keys(form) as Array<keyof ActivityEditorForm>) {
    const value = activity[key];
    if (key === 'gallery') form.gallery = (activity.gallery || []).join('\n');
    else form[key] = value === undefined || value === null ? '' : String(value);
  }
  return form;
}

function validImage(value: string) {
  if (value.startsWith('/static/')) return true;
  return /^https:\/\/[^\s]+$/i.test(value);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function buildActivityPayload(form: ActivityEditorForm, enabled: boolean) {
  if (!form.title.trim()) throw new Error('请填写活动标题');
  if (!form.description.trim() || !form.fullDescription.trim()) throw new Error('请填写活动简介和正文');
  if (!validImage(form.coverImage.trim())) throw new Error('请上传封面或填写有效的 HTTPS 图片链接');
  if (!validDate(form.startDate) || !validDate(form.endDate)) throw new Error('请填写有效的开始和结束日期');
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!validTime.test(form.startTime) || !validTime.test(form.endTime)) throw new Error('请填写开始和结束时间');
  const start = Date.parse(`${form.startDate}T${form.startTime}:00+08:00`);
  const end = Date.parse(`${form.endDate}T${form.endTime}:00+08:00`);
  if (end <= start) throw new Error('结束时间必须晚于开始时间');
  if (enabled && end <= Date.now()) throw new Error('活动已经结束，请更新档期后再发布');
  if (!form.location.trim()) throw new Error('请填写活动地点');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(form.price.trim())) throw new Error('请填写有效单价，免费活动填 0，最多两位小数');
  const price = Number(form.price);
  if (!Number.isSafeInteger(Math.round(price * 100))) throw new Error('单价超出支持范围');
  if (!/^[1-9]\d*$/.test(form.maxParticipants.trim()) || !Number.isSafeInteger(Number(form.maxParticipants))) throw new Error('名额必须是大于 0 的整数');
  if (!form.category.trim()) throw new Error('请填写活动分类');
  const gallery = [...new Set(form.gallery.split('\n').map((line) => line.trim()).filter(Boolean))];
  if (gallery.some((url) => !validImage(url))) throw new Error('详情图片请每行填写一个 HTTPS 图片链接');
  return {
    title: form.title.trim(), description: form.description.trim(), fullDescription: form.fullDescription.trim(),
    coverImage: form.coverImage.trim(), cover: form.coverImage.trim(), covers: [form.coverImage.trim()], gallery,
    startDate: form.startDate, endDate: form.endDate, startTime: form.startTime, endTime: form.endTime,
    location: form.location.trim(), address: form.address.trim(), price,
    maxParticipants: Number(form.maxParticipants), category: form.category.trim(),
    hostName: form.hostName.trim(), refundPolicy: form.refundPolicy.trim(), enabled,
  };
}
