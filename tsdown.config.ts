// @env node
import { defineConfig } from 'tsdown'
import { StaleGuardRecorder } from 'tsdown-stale-guard'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/unocss.worker.ts',
  ],
  dts: true,
  exports: true,
  format: ['esm'],
  plugins: [
    StaleGuardRecorder(),
  ],
})
