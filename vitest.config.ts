import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    // Add setupFiles for globals
    setupFiles: [],
  },
  // Define globals for TypeScript
  define: {
    global: 'globalThis',
  },
});
