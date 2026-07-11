// @env node
import { icons as carbonIcons } from '@iconify-json/carbon'
import transformerVariantGroup from '@unocss/transformer-variant-group'
import {
  defineConfig,
  presetIcons,
  presetWind3,
} from 'unocss'

export default defineConfig({
  theme: {
    fontSize: {
      micro: ['9px', '14px'],
    },
  },
  shortcuts: [
    {
      'bg-base': 'bg-[var(--color-bg-base)]',
      'bg-panel': 'bg-[var(--color-bg-panel)]',
      'bg-secondary': 'bg-[var(--color-bg-secondary)]',
      'border-base': 'border-[var(--color-border-base)]',
      'color-base': 'text-[var(--color-text-base)]',
      'color-muted': 'text-[var(--color-text-muted)]',
      'color-active': 'text-[var(--color-text-active)]',
      'color-danger': 'text-[var(--color-text-danger)]',
      'app-shell': 'h-screen h-[100dvh] w-screen flex flex-col of-hidden bg-base color-base font-sans antialiased',
      'brand-mark': 'h-8 w-8 shrink-0 inline-flex items-center justify-center',
      'pane-shell': 'h-full min-h-0 flex flex-col of-hidden bg-panel',
      'pane-header': 'h-8 shrink-0 flex items-center justify-between gap-3 border-b border-base bg-secondary px-3',
      'pane-title': 'truncate font-mono text-micro font-600 uppercase tracking-[0.14em] color-base',
      'pane-detail': 'truncate font-mono text-micro tabular-nums color-muted transition-colors duration-200',
      'pad-safe': 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
      'skip-link': 'fixed left-3 top-3 z-skip-link translate-y-[-150%] rounded-md bg-panel px-3 py-2 text-sm color-base shadow-lg focus:translate-y-0 focus:outline-solid focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-accent)]',
      'toolbar-action': 'relative after:absolute after:-inset-1 after:content-empty inline-flex h-8 w-8 items-center justify-center rounded border border-transparent bg-transparent color-muted transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out-strong)] hover:border-base hover:bg-secondary hover:color-base active:scale-95 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
      'workspace-bar': 'z-top-nav h-10 shrink-0 flex items-center justify-between border-b border-base bg-panel px-2.5 sm:px-3',
      'z-top-nav': 'z-60',
      'z-panel-content': 'z-10',
      'z-skip-link': 'z-100',
    },
  ],
  presets: [
    presetWind3(),
    presetIcons({
      collections: {
        carbon: () => carbonIcons,
      },
      scale: 1.15,
    }),
  ],
  transformers: [
    transformerVariantGroup(),
  ],
})
