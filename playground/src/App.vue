<script setup lang="ts">
import PlaygroundShell from './components/playground/PlaygroundShell.vue'
import { createPlaygroundMonaco } from './monaco/createPlaygroundMonaco'

const playgroundMonaco = createPlaygroundMonaco()

onUnmounted(() => playgroundMonaco.dispose())
</script>

<template>
  <PlaygroundShell :monaco="playgroundMonaco" />
</template>
