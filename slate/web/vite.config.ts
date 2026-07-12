import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    port: Number(process.env.PORT) || 5174,
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
  },
});
