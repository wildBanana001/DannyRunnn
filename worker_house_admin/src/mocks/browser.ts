import { setupWorker } from 'msw/browser';
import { activityHandlers } from '@/mocks/handlers/activity';
import { authHandlers } from '@/mocks/handlers/auth';
import { cardOrderHandlers } from '@/mocks/handlers/cardOrder';
import { posterHandlers } from '@/mocks/handlers/poster';
import { profileHandlers } from '@/mocks/handlers/profile';
import { registrationHandlers } from '@/mocks/handlers/registration';
import { siteConfigHandlers } from '@/mocks/handlers/siteConfig';
import { treeholeHandlers } from '@/mocks/handlers/treehole';

const worker = setupWorker(
  ...authHandlers,
  ...activityHandlers,
  ...registrationHandlers,
  ...cardOrderHandlers,
  ...profileHandlers,
  ...treeholeHandlers,
  ...posterHandlers,
  ...siteConfigHandlers,
);
let workerReady: Promise<ServiceWorkerRegistration | undefined> | null = null;

export async function initializeMockServiceWorker() {
  if (import.meta.env.VITE_ENABLE_MSW !== 'true') {
    return;
  }

  if (!workerReady) {
    workerReady = worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
  }

  await workerReady;
}
