import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'opencode-dev/**',
      'claude-src/**',
      // Vendored third-party reference projects — not part of EchoAI's suite.
      'samples/**',
      'sample-code-main/**',
      'third-party-main/**',
      // Local upstream Code-OSS overlay target (see apps/ide base:apply). It ships
      // its own test suites, which are not part of EchoAI's and cannot run here.
      'vscode-main/**',
      'vscode-*/**',
      // Hosted SaaS has its own workspace/test setup.
      'hosted/**',
      // Apps have their own vitest configs and path aliases; run via test:packages.
      'apps/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});