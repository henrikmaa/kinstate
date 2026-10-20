import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import kinstate from '@kinstate/compiler/vite';
export default defineConfig({ plugins: [kinstate({ reactiveProps: true }), react()] });
