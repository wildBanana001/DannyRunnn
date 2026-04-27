import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, InputNumber, Space, Spin, Switch, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ImageUploader from '@/components/ImageUploader';
import PageHeader from '@/components/PageHeader';
import { createPoster, getPosterDetail, updatePoster } from '@/services/poster';
import type { Poster } from '@/types/poster';

interface PosterFormValues {
  coverImage: string;
  detailImages: string[];
  enabled: boolean;
  sort: number;
  title: string;
}

function normalizeDetailImages(values?: string[]) {
  return (values ?? []).map((item) => item.trim()).filter(Boolean);
}

function PosterEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm<PosterFormValues>();
  const [loading, setLoading] = useState(Boolean(id));
  const [submitting, setSubmitting] = useState(false);
  const [currentPoster, setCurrentPoster] = useState<Poster | null>(null);

  const isEdit = useMemo(() => Boolean(id), [id]);
  const coverImage = Form.useWatch('coverImage', form);
  const detailImages = Form.useWatch('detailImages', form) ?? [];

  useEffect(() => {
    if (!id) {
      form.setFieldsValue({
        detailImages: [],
        enabled: true,
        sort: 0,
      });
      return;
    }

    const loadDetail = async () => {
      setLoading(true);

      try {
        const detail = await getPosterDetail(id);
        setCurrentPoster(detail);
        form.setFieldsValue({
          title: detail.title,
          coverImage: detail.coverImage,
          detailImages: detail.detailImages,
          enabled: detail.enabled,
          sort: detail.sort,
        });
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [form, id]);

  const handleSubmit = async (values: PosterFormValues) => {
    const normalizedDetailImages = normalizeDetailImages(values.detailImages);
    const payload = {
      title: values.title.trim(),
      coverImage: values.coverImage.trim(),
      detailImages: normalizedDetailImages,
      enabled: values.enabled,
      sort: values.sort ?? 0,
    };

    if (!payload.coverImage) {
      message.error('请维护封面图');
      return;
    }

    if (!normalizedDetailImages.length) {
      message.error('至少添加一张详情图');
      return;
    }

    setSubmitting(true);

    try {
      if (id && currentPoster) {
        await updatePoster(id, {
          ...payload,
          createdAt: currentPoster.createdAt,
          id,
          updatedAt: currentPoster.updatedAt,
        });
      } else {
        await createPoster(payload);
      }

      message.success(isEdit ? '海报更新成功' : '海报新增成功');
      navigate('/poster');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader title={isEdit ? '编辑海报' : '新增海报'} subtitle="维护海报标题、图片与启用状态，支持实时预览效果" />

      <Spin spinning={loading} tip="正在加载海报详情...">
        <Form<PosterFormValues> form={form} layout="vertical" onFinish={handleSubmit}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card bordered={false} title="基础信息">
              <Form.Item<PosterFormValues>
                label="标题"
                name="title"
                rules={[{ required: true, message: '请输入标题' }]}
              >
                <Input placeholder="请输入海报标题" />
              </Form.Item>
              <Form.Item<PosterFormValues>
                label="封面图"
                name="coverImage"
                rules={[{ required: true, message: '请维护封面图' }]}
              >
                <ImageUploader helperText="支持上传，也支持继续手动填写 URL。" />
              </Form.Item>
              <Form.Item<PosterFormValues>
                label="详情图列表"
                name="detailImages"
                rules={[
                  {
                    validator: async (_, value) => {
                      if (normalizeDetailImages(value).length) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('至少添加一张有效的详情图 URL'));
                    },
                  },
                ]}
              >
                <ImageUploader helperText="支持多图上传、顺序调整与手动录入 URL。" maxCount={12} multiple />
              </Form.Item>
              <Space size={24} style={{ marginTop: 16 }}>
                <Form.Item label="排序值" name="sort" initialValue={0}>
                  <InputNumber min={0} />
                </Form.Item>
                <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue>
                  <Switch />
                </Form.Item>
              </Space>
            </Card>

            <Card bordered={false} title="实时预览">
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div>
                  <Typography.Text type="secondary">封面预览</Typography.Text>
                  <div
                    style={{
                      backgroundColor: '#f5f5f5',
                      borderRadius: 4,
                      height: 160,
                      marginTop: 8,
                      overflow: 'hidden',
                      width: 120,
                    }}
                  >
                    {coverImage ? (
                      <img alt="封面预览" src={coverImage} style={{ height: '100%', objectFit: 'cover', width: '100%' }} />
                    ) : (
                      <div
                        style={{
                          alignItems: 'center',
                          color: '#999',
                          display: 'flex',
                          fontSize: 12,
                          height: '100%',
                          justifyContent: 'center',
                        }}
                      >
                        暂无封面图
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Typography.Text type="secondary">详情图预览</Typography.Text>
                  <Space size={8} wrap style={{ marginTop: 8 }}>
                    {normalizeDetailImages(detailImages).map((url) => (
                      <div
                        key={url}
                        style={{
                          backgroundColor: '#f5f5f5',
                          borderRadius: 4,
                          height: 80,
                          overflow: 'hidden',
                          width: 80,
                        }}
                      >
                        <img alt="详情图预览" src={url} style={{ height: '100%', objectFit: 'cover', width: '100%' }} />
                      </div>
                    ))}
                    {!normalizeDetailImages(detailImages).length ? (
                      <Typography.Text type="secondary">暂无详情图</Typography.Text>
                    ) : null}
                  </Space>
                </div>
              </Space>
            </Card>

            <Card bordered={false}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/poster')}>
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

export default PosterEditPage;
