/**
 * Dev-сервер Vite: фронт на :5173, API и WebSocket проксируются на Node (обычно :3001).
 * В production статику отдаёт тот же Node — прокси не используется.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:3001', ws: true },
    },
  },
});
