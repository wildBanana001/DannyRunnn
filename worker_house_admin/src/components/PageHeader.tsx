import type { ReactNode } from 'react';
import { Typography } from 'antd';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
}

function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <Typography.Title className="page-header__title" level={3}>
          {title}
        </Typography.Title>
        {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
      </div>
      {extra ? <div>{extra}</div> : null}
    </div>
  );
}

export default PageHeader;
