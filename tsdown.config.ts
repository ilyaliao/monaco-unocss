import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/unocss.worker.ts',
  ],
  format: ['esm', 'cjs'],
})
