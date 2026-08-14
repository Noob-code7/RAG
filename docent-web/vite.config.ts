import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/notebooks': 'http://localhost:3001',
      '/documents': 'http://localhost:3001',
      '/query': 'http://localhost:3001',
    },
  },
});