<script setup lang="ts">
import type { editor, IDisposable } from 'monaco-editor'
import type { PlaygroundMonaco } from '../../monaco/createPlaygroundMonaco'
import type { PaneTone } from '../../types'
import PaneHeader from './PaneHeader.vue'

interface Props {
  detail: string
  editorLabel: string
  language: 'css' | 'html'
  liveDetail?: boolean
  modelValue: string
  monaco: PlaygroundMonaco
  readOnly?: boolean
  revealMarker?: string
  title: string
  tone?: PaneTone
}

const props = withDefaults(defineProps<Props>(), {
  liveDetail: false,
  readOnly: false,
  tone: 'muted',
})
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorElement = useTemplateRef<HTMLElement>('editorElement')
let editorInstance: editor.IStandaloneCodeEditor | undefined
let changeDisposable: IDisposable | undefined

function revealMarker(value: string): void {
  if (!editorInstance || !props.revealMarker) return

  const markerOffset = value.indexOf(props.revealMarker)
  if (markerOffset === -1) return

  const lineNumber = value.slice(0, markerOffset).split('\n').length
  editorInstance.revealLineNearTop(lineNumber)
}

onMounted(() => {
  if (!editorElement.value) return

  editorInstance = props.monaco.createEditor({
    ariaLabel: props.editorLabel,
    element: editorElement.value,
    language: props.language,
    readOnly: props.readOnly,
    value: props.modelValue,
  })
  changeDisposable = editorInstance.onDidChangeModelContent(() => {
    emit('update:modelValue', editorInstance?.getValue() ?? '')
  })
  revealMarker(props.modelValue)
})

watch(
  () => props.modelValue,
  (value) => {
    if (editorInstance && editorInstance.getValue() !== value) {
      editorInstance.setValue(value)
      revealMarker(value)
    }
  },
)

onUnmounted(() => {
  changeDisposable?.dispose()
  editorInstance?.dispose()
})
</script>

<template>
  <section class="pane-shell">
    <PaneHeader
      :detail="detail"
      :live-detail="liveDetail"
      :title="title"
      :tone="tone"
    />
    <div ref="editorElement" class="z-panel-content min-h-0 flex-1" />
  </section>
</template>
