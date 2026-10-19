import { defineConfig, Plugin } from 'vite';
import { sep } from 'node:path';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';

/**
 * Vite config for the UI.
 *
 * - `common` is a linked workspace package compiled to CommonJS. Vite does not
 *   pre-bundle linked packages by default, so it is listed in `optimizeDeps`
 *   to be converted to ESM for the dev server (Rolldown handles CJS in builds).
 * - `optimizeDeps.force` re-bundles on every dev-server start. Vite's dep cache
 *   only invalidates on lockfile/config changes, not when `common/dist` is
 *   rebuilt — without this, a restart can keep serving an old `common` that is
 *   missing newly added exports. `dev:ui` rebuilds `common` right before start.
 * - `vite-plugin-checker` runs `tsc` + ESLint in dev and shows errors in an
 *   overlay, since Vite itself only strips types. `npm run build` runs both
 *   before `vite build`, so the checker is dev-only.
 * - Output goes to `build/`, which the backend serves (`backend/src/index.ts`).
 */
/** Watches the linked `common` package's compiled output: `optimizeDeps` only
 * re-bundles at server start, so a mid-session `common` rebuild would keep
 * serving the stale copy — silently, until a new export is called and the app
 * crashes (seen 2026-10: `canRollSoldier` added → every attack crashed). A
 * restart re-bundles (force) and reloads the page. Note: chokidar v4 (Vite ≥7)
 * dropped glob support, so the directory is watched and changes are filtered. */
const restartOnCommonRebuild = (): Plugin => ({
  name: 'restart-on-common-rebuild',
  configureServer(server) {
    // A rebuild writes every dist file → one 'change' each. Restart once per
    // rebuild, not per file: back-to-back server.restart() calls collide on
    // the port (the previous listener hasn't released yet → strictPort kills
    // the process).
    let timer: NodeJS.Timeout | undefined;
    server.watcher.add('../common/dist');
    server.watcher.on('all', (event: string, file: string) => {
      if (event !== 'change' || !file.includes(`${sep}common${sep}dist${sep}`)) return;
      clearTimeout(timer);
      timer = setTimeout(() => server.restart(), 400);
    });
  },
});

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    command === 'serve' && restartOnCommonRebuild(),
    command === 'serve' &&
      checker({
        typescript: true,
        eslint: { useFlatConfig: true, lintCommand: 'eslint "./src/**/*.{ts,tsx}"' },
      }),
  ],
  optimizeDeps: {
    include: ['common'],
    force: true,
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'build',
  },
}));
