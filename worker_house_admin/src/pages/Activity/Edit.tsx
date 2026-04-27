import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { Button, Card, Form, Space, Spin, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { createActivity, getActivityDetail, updateActivity } from '@/services/activity';
import type { Activity } from '@/types';
import ActivityBasicSection from './components/ActivityBasicSection';
import ActivityHostVenueSection from './components/ActivityHostVenueSection';
import ActivityMediaSection from './components/ActivityMediaSection';
import ActivityOtherSection from './components/ActivityOtherSection';
import ActivityScheduleSection from './components/ActivityScheduleSection';
import type { ActivityFormValues } from './components/formTypes';

const categoryOptions = [
  '身心疗愈',
  '生活美学',
  '手工艺术',
  '烘焙',
  '摄影',
  '花艺',
  '品酒',
  '绘画',
  '运动社交',
  '主题沙龙',
].map((item) => ({ label: item, value: item }));

function toDynamicItems(values: string[]) {
  return values.length ? values.map((value) => ({ value })) : [];
}

function normalizeDynamicList(items?: Array<{ value: string }>) {
  return (items ?? []).map((item) => item.value.trim()).filter(Boolean);
}

function getActivityCovers(activity: Partial<Activity>) {
  return Array.from(
    new Set(
      [...(activity.covers ?? []), activity.cover ?? '', activity.coverImage ?? '']
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toTimeValue(value: string) {
  return dayjs(`2026-01-01T${value}:00`);
}

function normalizeImageList(values?: string[]) {
  return (values ?? []).map((item) => item.trim()).filter(Boolean);
}

function ActivityEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm<ActivityFormValues>();
  const [loading, setLoading] = useState(Boolean(id));
  const [submitting, setSubmitting] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);

  const isEdit = useMemo(() => Boolean(id), [id]);

  useEffect(() => {
    if (!id) {
      form.setFieldsValue({
        cardEligible: true,
        covers: [],
        gallery: [],
        includes: [],
        requirements: [],
        status: 'upcoming',
        tags: [],
        venueImages: [],
      });
      return;
    }

    const loadDetail = async () => {
      setLoading(true);

      try {
        const detail = await getActivityDetail(id);
        setCurrentActivity(detail);
        form.setFieldsValue({
          ...detail,
          cardEligible: detail.cardEligible ?? true,
          covers: getActivityCovers(detail),
          endDate: dayjs(detail.endDate),
          endTime: toTimeValue(detail.endTime),
          gallery: detail.gallery ?? [],
          includes: toDynamicItems(detail.includes),
          originalPrice: detail.originalPrice ?? null,
          requirements: toDynamicItems(detail.requirements),
          startDate: dayjs(detail.startDate),
          startTime: toTimeValue(detail.startTime),
          venueImages: detail.venueImages ?? [],
        });
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [form, id]);

  const handleSubmit = async (values: ActivityFormValues) => {
    const covers = normalizeImageList(values.covers);
    if (!covers.length) {
      message.error('请至少维护一张封面图');
      return;
    }

    const primaryCover = covers[0];
    const payload = {
      address: values.address.trim(),
      cardEligible: values.cardEligible ?? true,
      category: values.category.trim(),
      cover: primaryCover,
      coverImage: primaryCover,
      covers,
      currentParticipants: currentActivity?.currentParticipants ?? 0,
      description: values.description.trim(),
      endDate: values.endDate.format('YYYY-MM-DD'),
      endTime: values.endTime.format('HH:mm'),
      fullDescription: values.fullDescription.trim(),
      gallery: normalizeImageList(values.gallery),
      hostAvatar: values.hostAvatar.trim(),
      hostDescription: values.hostDescription.trim(),
      hostId: currentActivity?.hostId ?? `host-${nanoid(8)}`,
      hostName: values.hostName.trim(),
      includes: normalizeDynamicList(values.includes),
      location: values.location.trim(),
      maxParticipants: values.maxParticipants,
      originalPrice:
        typeof values.originalPrice === 'number' && values.originalPrice > 0 ? values.originalPrice : undefined,
      price: values.price,
      refundPolicy: values.refundPolicy.trim(),
      requirements: normalizeDynamicList(values.requirements),
      startDate: values.startDate.format('YYYY-MM-DD'),
      startTime: values.startTime.format('HH:mm'),
      status: values.status,
      tags: values.tags.map((item) => item.trim()).filter(Boolean),
      title: values.title.trim(),
      venueDescription: values.venueDescription.trim(),
      venueImages: normalizeImageList(values.venueImages),
      venueName: values.venueName.trim(),
    };

    setSubmitting(true);

    try {
      if (id && currentActivity) {
        await updateActivity(id, {
          ...payload,
          createdAt: currentActivity.createdAt,
          id,
          updatedAt: currentActivity.updatedAt,
        });
      } else {
        await createActivity(payload);
      }

      message.success(isEdit ? '活动更新成功' : '活动新增成功');
      navigate('/activity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        title={isEdit ? '编辑活动' : '新增活动'}
        subtitle="通过分区表单快速维护活动详情，字段与小程序端类型保持一致"
      />

      <Spin spinning={loading} tip="正在加载活动详情...">
        <Form<ActivityFormValues> form={form} layout="vertical" onFinish={handleSubmit}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <ActivityBasicSection categoryOptions={categoryOptions} />
            <ActivityScheduleSection />
            <ActivityMediaSection />
            <ActivityHostVenueSection />
            <ActivityOtherSection />

            <Card bordered={false}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/activity')}>
                  取消
                </Button>
                <Button htmlType="submit" icon={<SaveOutlined />} loading={submitting} type="primary">
                  保存
                </Button>
              </Space>
            </Card>
          </Space>
        </Form>
      </Spin>
    </div>
  );
}

export default ActivityEditPage;
