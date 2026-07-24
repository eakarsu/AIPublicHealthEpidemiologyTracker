import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.FRONTEND_PORT || 3001),
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${process.env.BACKEND_PORT || 4001}`,
    },
  },
});
