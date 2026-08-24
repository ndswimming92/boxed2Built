import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import reviewAggregateRating from './plugins/reviewAggregateRating';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), reviewAggregateRating()],
  build: {
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['recharts'],
  },
  ssgOptions: {
    dirStyle: 'flat',
    script: 'defer',
    mock: true,
    includedRoutes(paths) {
      // vite-react-ssg hands nested child routes over without a leading slash
      // ("admin/dashboard", not "/admin/dashboard"), so normalise before
      // matching — otherwise every auth-gated page gets pre-rendered into dist.
      return paths.filter(rawPath => {
        const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
        if (path === '/admin' || path.startsWith('/admin/')) return false;
        if (path === '/portal' || path.startsWith('/portal/')) return false;
        if (path.startsWith('/go/')) return false;
        if (path.startsWith('/pay/')) return false;
        if (path.includes(':')) return false;
        // The `*` catch-all only exists for client-side navigation; pre-rendering
        // it would write a literal dist/*.html. dist/404.html comes from the
        // explicit `/404` route instead, and Netlify serves it on a real 404.
        if (path.includes('*')) return false;
        return true;
      });
    },
  },
});
