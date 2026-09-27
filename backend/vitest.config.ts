import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    exclude: ['node_modules/**', 'dist/**'],
    // Tests never touch a real database; this only satisfies startup validation.
    env: {
      DATABASE_URL: 'mysql://test:test@localhost:3306/rxbooks_test',
      JWT_SECRET: 'test-only-secret-that-is-at-least-32-chars',
    },
    include: ['**/*.spec.ts'],
  },
});
