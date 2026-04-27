import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Space, Typography } from 'antd';

interface DynamicListFieldProps {
  addText: string;
  allowSort?: boolean;
  helperText?: string;
  label: string;
  name: string;
  placeholder: string;
}

function DynamicListField({
  addText,
  allowSort = false,
  helperText,
  label,
  name,
  placeholder,
}: DynamicListFieldProps) {
  return (
    <Form.Item label={label}>
      <div className="dynamic-list-card">
        <Form.List name={name}>
          {(fields, { add, move, remove }) => (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {fields.map((field, index) => (
                <Space key={field.key} align="start" style={{ width: '100%' }}>
                  <Form.Item
                    {...field}
                    name={[field.name, 'value']}
                    rules={[{ required: true, message: '请补充完整' }]}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Input placeholder={placeholder} />
                  </Form.Item>
                  {allowSort ? (
                    <Space direction="vertical" size={4}>
                      <Button
                        icon={<ArrowUpOutlined />}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      />
                      <Button
                        icon={<ArrowDownOutlined />}
                        disabled={index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                      />
                    </Space>
                  ) : null}
                  <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                </Space>
              ))}
              <Button
                block
                icon={<PlusOutlined />}
                type="dashed"
                onClick={() => add({ value: '' })}
              >
                {addText}
              </Button>
              {helperText ? <Typography.Text type="secondary">{helperText}</Typography.Text> : null}
              {fields.length === 0 ? (
                <Typography.Text type="secondary">暂无内容</Typography.Text>
              ) : null}
            </Space>
          )}
        </Form.List>
      </div>
    </Form.Item>
  );
}

export default DynamicListField;
