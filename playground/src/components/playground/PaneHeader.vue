<script setup lang="ts">
import type { PaneTone } from '../../types'

interface Props {
  detail?: string
  liveDetail?: boolean
  title?: string
  tone?: PaneTone
}

const props = withDefaults(defineProps<Props>(), {
  liveDetail: false,
  tone: 'muted',
})

const detailClass = computed(() => ({
  'color-active': props.tone === 'active',
  'color-danger': props.tone === 'danger',
  'color-muted': props.tone === 'muted',
}))
</script>

<template>
  <header class="pane-header">
    <slot name="title">
      <h2 v-if="title" class="pane-title">
        {{ title }}
      </h2>
    </slot>
    <span
      v-if="detail"
      class="pane-detail"
      :class="detailClass"
      :title="detail"
      :aria-live="liveDetail ? 'polite' : undefined"
    >
      {{ detail }}
    </span>
  </header>
</template>
