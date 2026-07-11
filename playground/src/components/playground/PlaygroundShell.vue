<script setup lang="ts">
import type { PlaygroundMonaco } from '../../monaco/createPlaygroundMonaco'
import { Pane, Splitpanes } from 'splitpanes'
import { usePlayground } from '../../composables/usePlayground'
import MonacoPane from './MonacoPane.vue'
import PreviewPane from './PreviewPane.vue'

const props = defineProps<{
  monaco: PlaygroundMonaco
}>()

const {
  css,
  cssDetail,
  html,
  isDark,
  previewDocument,
  statusTone,
  toggleTheme,
} = usePlayground(props.monaco)
</script>

<template>
  <div class="app-shell pad-safe">
    <a class="skip-link" href="#playground-main">Skip to playground</a>

    <header class="workspace-bar">
      <h1 class="sr-only">monaco-unocss playground</h1>
      <span class="brand-mark" title="UnoCSS" aria-hidden="true">
        <img class="h-7 w-7" src="/unocss.svg" alt="">
      </span>

      <div class="flex items-center">
        <button
          class="toolbar-action"
          type="button"
          aria-label="Dark theme"
          :aria-pressed="isDark"
          :title="isDark ? 'Use light theme' : 'Use dark theme'"
          @click="toggleTheme"
        >
          <Transition name="theme-icon">
            <span v-if="isDark" class="i-carbon-sun" aria-hidden="true" />
            <span v-else class="i-carbon-moon" aria-hidden="true" />
          </Transition>
        </button>
      </div>
    </header>

    <main id="playground-main" class="min-h-0 flex-1" tabindex="-1">
      <Splitpanes class="playground-splitpanes" :keyboard-step="2">
        <Pane :min-size="30" :size="56">
          <MonacoPane
            detail="index.html"
            editor-label="Editable HTML document"
            language="html"
            :model-value="html"
            :monaco="monaco"
            title="HTML"
            @update:model-value="html = $event"
          />
        </Pane>

        <Pane :min-size="30" :size="44">
          <Splitpanes class="playground-splitpanes" horizontal :keyboard-step="2">
            <Pane :min-size="24" :size="53">
              <PreviewPane
                :css="css"
                :srcdoc="previewDocument"
              />
            </Pane>
            <Pane :min-size="24" :size="47">
              <MonacoPane
                :detail="cssDetail"
                editor-label="Generated CSS output"
                language="css"
                :model-value="css"
                :monaco="monaco"
                live-detail
                read-only
                reveal-marker="/* layer: default */"
                title="CSS"
                :tone="statusTone"
              />
            </Pane>
          </Splitpanes>
        </Pane>
      </Splitpanes>
    </main>
  </div>
</template>
