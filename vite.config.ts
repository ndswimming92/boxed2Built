import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
      return paths.filter(path => {
        if (path.startsWith('/admin')) return false;
        if (path.startsWith('/portal')) return false;
        if (path.startsWith('/go/')) return false;
        if (path.startsWith('/pay/')) return false;
        if (path.includes(':')) return false;
        return true;
      });
    },
  },
});
