import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import electron from 'vite-plugin-electron';

const nodeBuiltins = builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]);
const aliases = {
  '@main': resolve(__dirname, 'src/main'),
  '@preload': resolve(__dirname, 'src/preload'),
  '@renderer': resolve(__dirname, 'src/renderer'),
  '@shared': resolve(__dirname, 'src/shared'),
};

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart({ startup }) {
          startup();
        },
        vite: {
          resolve: {
            alias: aliases,
          },
          build: {
            outDir: 'dist-electron/main',
            emptyOutDir: true,
            rollupOptions: {
              external: [...nodeBuiltins, 'electron'],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart({ reload }) {
          reload();
        },
        vite: {
          resolve: {
            alias: aliases,
          },
          build: {
            outDir: 'dist-electron/preload',
            emptyOutDir: true,
            // `vite-plugin-electron` derives `build.lib.formats` from the host
            // package.json `type` field, which is "module" here. Lib formats win
            // over `rollupOptions.output.format`, so lib mode would emit ESM into
            // a `.cjs` file and Electron's sandboxed preload loader would fail with
            // "Cannot use import statement outside a module". Opting out of lib
            // mode lets the explicit CommonJS output below take effect.
            lib: false,
            modulePreload: false,
            rollupOptions: {
              input: resolve(__dirname, 'src/preload/index.ts'),
              external: ['electron'],
              output: {
                format: 'cjs',
                inlineDynamicImports: true,
                entryFileNames: 'index.cjs',
                chunkFileNames: '[name].cjs',
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: aliases,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    strictPort: false,
    watch: {
      ignored: ['**/dist/**', '**/dist-electron/**', '**/release/**'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
