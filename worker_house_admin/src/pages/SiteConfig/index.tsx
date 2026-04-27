import { SaveOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Row, Space, Spin, message } from 'antd';
import { useEffect, useState } from 'react';
import ImageUploader from '@/components/ImageUploader';
import PageHeader from '@/components/PageHeader';
import { getSiteConfig, updateSiteConfig } from '@/services/site';
import type { SiteConfig } from '@/types/site';

type SiteConfigFormValues = SiteConfig;

function SiteConfigPage() {
  const [form] = Form.useForm<SiteConfigFormValues>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);

      try {
        const config = await getSiteConfig();
        form.setFieldsValue(config);
      } finally {
        setLoading(false);
      }
    };

    void loadConfig();
  }, [form]);

  const handleSubmit = async (values: SiteConfigFormValues) => {
    setSubmitting(true);

    try {
      const payload: SiteConfig = {
        ownerName: values.ownerName?.trim() ?? '',
        ownerAvatar: values.ownerAvatar?.trim() ?? '',
        ownerBio: values.ownerBio ?? '',
        spaceImage: values.spaceImage?.trim() ?? '',
        spaceDescription: values.spaceDescription ?? '',
        videoFinderUserName: values.videoFinderUserName?.trim() ?? '',
        videoFeedId: values.videoFeedId?.trim() ?? '',
        videoCover: values.videoCover?.trim() ?? '',
        videoTitle: values.videoTitle?.trim() ?? '',
      };

      await updateSiteConfig(payload);
      message.success('配置已保存');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader title="站点配置" subtitle="维护主理人、空间介绍与视频号等站点展示信息" />

      <Spin spinning={loading} tip="正在加载站点配置...">
        <Form<SiteConfigFormValues> form={form} layout="vertical" onFinish={handleSubmit}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card bordered={false} title="主理人">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="主理人姓名" name="ownerName">
                    <Input placeholder="请输入主理人姓名" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="主理人头像" name="ownerAvatar">
                    <ImageUploader helperText="支持上传图片，也支持继续手动填写 URL。" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="主理人简介" name="ownerBio">
                    <Input.TextArea rows={6} placeholder="请输入主理人简介" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card bordered={false} title="空间介绍">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="空间图片" name="spaceImage">
                    <ImageUploader helperText="支持上传空间主图，也支持粘贴历史 URL。" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="空间介绍文案" name="spaceDescription">
                    <Input.TextArea rows={6} placeholder="请输入空间介绍文案" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card bordered={false} title="视频号">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    extra="视频号 ID，形如 v2_xxxxx@finder"
                    label="视频号 ID"
                    name="videoFinderUserName"
                  >
                    <Input placeholder="请输入视频号 ID" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="视频 Feed ID（可选）" name="videoFeedId">
                    <Input placeholder="可选，填写具体视频 Feed ID" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="视频封面图" name="videoCover">
                    <ImageUploader helperText="支持上传封面图，也支持手动录入 URL。" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="视频标题" name="videoTitle">
                    <Input placeholder="请输入视频标题" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card bordered={false}>
              <Button
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={submitting}
                style={{ backgroundColor: '#E63946', borderColor: '#E63946' }}
                type="primary"
              >
                保存配置
              </Button>
            </Card>
          </Space>
        </Form>
      </Spin>
    </div>
  );
}

export default SiteConfigPage;
