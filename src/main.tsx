import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes';
import './index.css';

export const createRoot = ViteReactSSG(
  { routes },
  ({ isClient }) => {
    if (isClient) {
      import('./utils/ssgLoaderGuard').then(({ primeStaticLoaderManifest }) => {
        void primeStaticLoaderManifest();
      });
      import('./utils/authHardening').then(({ enforceHttpsInBrowser }) => {
        enforceHttpsInBrowser();
      });
    }
  },
);
