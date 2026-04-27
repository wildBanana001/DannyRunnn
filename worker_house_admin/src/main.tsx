import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import locale from 'antd/locale/zh_CN';
import { App as AntdApp, ConfigProvider, Empty } from 'antd';
import 'antd/dist/reset.css';
import App from '@/App';
import { initializeMockServiceWorker } from '@/mocks/browser';
import '@/styles/global.scss';

dayjs.locale('zh-cn');

function restoreRedirectPath() {
  const nextPath = window.sessionStorage.getItem('worker_house_admin_redirect');

  if (nextPath) {
    window.sessionStorage.removeItem('worker_house_admin_redirect');
    window.history.replaceState(null, '', nextPath);
  }
}

async function bootstrap() {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element #root 不存在');
  }

  restoreRedirectPath();
  await initializeMockServiceWorker();

  createRoot(rootElement).render(
    <StrictMode>
      <ConfigProvider
        locale={locale}
        renderEmpty={() => <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
        theme={{
          token: {
            colorPrimary: '#E63946',
            borderRadius: 16,
            colorBgLayout: '#F6F7FB',
            colorTextBase: '#1F2937',
            fontFamily:
              'Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, -apple-system, BlinkMacSystemFont, sans-serif',
          },
        }}
      >
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </StrictMode>,
  );
}

void bootstrap();
