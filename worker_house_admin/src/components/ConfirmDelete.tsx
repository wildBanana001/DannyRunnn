import type { ReactNode } from 'react';
import { Popconfirm } from 'antd';

interface ConfirmDeleteProps {
  children: ReactNode;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
}

function ConfirmDelete({
  children,
  onConfirm,
  title = '确认删除这条记录吗？',
  description = '删除后不可恢复，请谨慎操作。',
}: ConfirmDeleteProps) {
  return (
    <Popconfirm
      title={title}
      description={description}
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      onConfirm={onConfirm}
    >
      {children}
    </Popconfirm>
  );
}

export default ConfirmDelete;
