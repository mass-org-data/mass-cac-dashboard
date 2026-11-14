import {defineConfig, type Plugin} from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';
import {readRuntimeConfig} from '../scripts/runtime-config.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const virtualId = 'mass-runtime-config';

// Same virtual module the current app uses: build-time, public configuration only.
function runtimeConfig(): Plugin {
  return {
    name: 'mass-runtime-config',
    resolveId: id => (id === virtualId ? `\0${virtualId}` : null),
    load(id) {
      if (id !== `\0${virtualId}`) return null;
      return `export const runtimeConfig=${JSON.stringify(readRuntimeConfig().config)};`;
    },
  };
}

export default defineConfig({
  root,
  base: './',
  plugins: [react(), tailwindcss(), runtimeConfig()],
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    // The build script has already written the original app to dist/vanilla and must not be cleared.
    emptyOutDir: false,
    sourcemap: false,
    // No inline script: the CSP allows script-src 'self' only.
    modulePreload: {polyfill: false},
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
