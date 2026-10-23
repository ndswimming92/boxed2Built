import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes';
import './index.css';
import { discardPrerenderedShell } from './utils/discardPrerenderedShell';

// Must run before ViteReactSSG decides whether to hydrate.
if (typeof window !== 'undefined') {
  discardPrerenderedShell(window.location.pathname, document.getElementById('root'), window);
}

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
