import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';

/**
 * Vite config for the UI.
 *
 * - `common` is a linked workspace package compiled to CommonJS. Vite does not
 *   pre-bundle linked packages by default, so it is listed in `optimizeDeps`
 *   to be converted to ESM for the dev server (Rolldown handles CJS in builds).
 * - `vite-plugin-checker` runs `tsc` + ESLint in dev and shows errors in an
 *   overlay, since Vite itself only strips types. `npm run build` runs both
 *   before `vite build`, so the checker is dev-only.
 * - Output goes to `build/`, which the backend serves (`backend/src/index.ts`).
 */
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    command === 'serve' &&
      checker({
        typescript: true,
        eslint: { useFlatConfig: true, lintCommand: 'eslint "./src/**/*.{ts,tsx}"' },
      }),
  ],
  optimizeDeps: {
    include: ['common'],
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'build',
  },
}));
