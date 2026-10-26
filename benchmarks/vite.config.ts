import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import kinstate from '@kinstate/compiler/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('./browser', import.meta.url)),
  plugins: [kinstate({ reactiveProps: true, include: /kinstate-consumers\.tsx$/ }), react()],
  build: { outDir: '../.dist', emptyOutDir: true },
});
