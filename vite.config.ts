import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // GitHub Pages needs a repo base path — adjust to your repo name
      base: '/Roshines/',
      server: {
        port: 3000,
        host: 'localhost',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // match the folder your deploy script publishes (set to 'build' or 'dist')
        outDir: 'build'
      }
    };
});