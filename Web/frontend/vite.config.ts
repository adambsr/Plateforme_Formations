import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: fileURLToPath(
        new URL('../../node_modules/react', import.meta.url),
      ),
      'react-dom': fileURLToPath(
        new URL('./node_modules/react-dom', import.meta.url),
      ),
    },
  },
  ssr: {
    noExternal: ['lucide-react'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    server: {
      deps: {
        inline: ['lucide-react', 'react-hook-form'],
      },
    },
  },
});
