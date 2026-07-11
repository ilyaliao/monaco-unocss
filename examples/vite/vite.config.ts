// @env node
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

export default defineConfig(() => ({
  plugins: [UnoCSS()],
  worker: {
    format: 'es' as const,
  },
}))
