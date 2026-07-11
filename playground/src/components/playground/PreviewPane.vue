<script setup lang="ts">
import PaneHeader from './PaneHeader.vue'
import { createPreviewDocumentAccessor } from './preview-frame-document'
import { syncDocumentElement } from './sync-document-element'

interface Props {
  css: string
  srcdoc: string
}

const props = defineProps<Props>()

const previewFrame = useTemplateRef<HTMLIFrameElement>('previewFrame')
const getPreviewDocument = createPreviewDocumentAccessor()
// The srcdoc attribute is only used for the first paint; later documents are
// morphed into the live DOM so the iframe never reloads while typing.
const initialSrcdoc = props.srcdoc
let generatedStyles: HTMLStyleElement | undefined

function ensureGeneratedStyles(previewDocument: Document): HTMLStyleElement {
  let styles = generatedStyles
  if (!styles || styles.ownerDocument !== previewDocument || !styles.isConnected) {
    styles = previewDocument.createElement('style')
    styles.dataset.monacoUnocss = 'generated'
    previewDocument.head.append(styles)
    generatedStyles = styles
  }

  return styles
}

function renderPreview(): void {
  const frame = previewFrame.value
  if (!frame)
    return

  const previewDocument = getPreviewDocument(frame, props.srcdoc)
  if (!previewDocument)
    return

  const next = new DOMParser().parseFromString(props.srcdoc, 'text/html')
  syncDocumentElement(previewDocument.documentElement, next.documentElement)
  ensureGeneratedStyles(previewDocument).textContent = props.css
}

watch(() => props.srcdoc, () => renderPreview())

watch(
  () => props.css,
  (css) => {
    const frame = previewFrame.value
    if (!frame)
      return

    const previewDocument = getPreviewDocument(frame, props.srcdoc)
    if (!previewDocument)
      return

    ensureGeneratedStyles(previewDocument).textContent = css
  },
)
</script>

<template>
  <section class="pane-shell">
    <PaneHeader title="Preview" />
    <iframe
      ref="previewFrame"
      class="z-panel-content min-h-0 w-full flex-1 border-0 bg-panel"
      :srcdoc="initialSrcdoc"
      sandbox="allow-same-origin"
      title="Rendered HTML preview"
      @load="renderPreview"
    />
  </section>
</template>
