import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Throwaway: the dev config minus vite-plugin-checker, for a browser test
// while the working tree has unrelated in-progress type errors.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ['common'], force: true },
});
