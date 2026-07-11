// @env node
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'

const monacoUnocssEntry = fileURLToPath(
  new URL('../src/index.ts', import.meta.url),
)
const monacoUnocssWorkerEntry = fileURLToPath(
  new URL('../src/unocss.worker.ts', import.meta.url),
)

export default defineConfig({
  plugins: [
    Vue(),
    AutoImport({
      dts: 'src/auto-imports.d.ts',
      imports: ['vue'],
      vueTemplate: true,
    }),
    UnoCSS(),
  ],
  resolve: {
    alias: [
      {
        find: /^monaco-unocss$/,
        replacement: monacoUnocssEntry,
      },
      {
        find: /^monaco-unocss\/unocss\.worker$/,
        replacement: monacoUnocssWorkerEntry,
      },
    ],
  },
  worker: {
    format: 'es',
  },
})
