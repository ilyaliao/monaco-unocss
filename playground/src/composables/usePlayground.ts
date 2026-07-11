import type { ComputedRef, Ref } from 'vue'
import type { PlaygroundMonaco, PlaygroundTheme } from '../monaco/createPlaygroundMonaco'
import type { PaneTone } from '../types'
import { computed, readonly, shallowRef, watch } from 'vue'
import { initialDocument } from '../constants'

type GenerationStatus = 'error' | 'generating' | 'ready'

interface ArtifactSnapshot {
  css: string
  html: string
}

interface StatusPresentation {
  cssDetail: string
  tone: PaneTone
}

export interface PlaygroundState {
  css: ComputedRef<string>
  cssDetail: ComputedRef<string>
  html: Ref<string>
  isDark: Readonly<Ref<boolean>>
  previewDocument: ComputedRef<string>
  statusTone: ComputedRef<PaneTone>
  toggleTheme: () => void
}

const generationDelay = 200
const busyIndicatorDelay = 400

function buildPreviewDocument(html: string, isDark: boolean): string {
  const preview = new DOMParser().parseFromString(html, 'text/html')
  preview.documentElement.classList.toggle('dark', isDark)

  return `<!doctype html>\n${preview.documentElement.outerHTML}`
}

function formatByteCount(css: string): string {
  const bytes = new TextEncoder().encode(css).byteLength
  return `${new Intl.NumberFormat('en-US').format(bytes)} bytes`
}

export function usePlayground(monaco: PlaygroundMonaco): PlaygroundState {
  const html = shallowRef(initialDocument)
  const isDark = shallowRef(window.matchMedia('(prefers-color-scheme: dark)').matches)
  const status = shallowRef<GenerationStatus>('generating')
  const errorMessage = shallowRef('')
  const artifact = shallowRef<ArtifactSnapshot>()
  const showBusy = shallowRef(false)
  let currentRevision = 0

  watch(status, (value, _previousValue, onCleanup) => {
    if (value !== 'generating') {
      showBusy.value = false
      return
    }

    const timeout = window.setTimeout(() => {
      showBusy.value = true
    }, busyIndicatorDelay)

    onCleanup(() => window.clearTimeout(timeout))
  }, { immediate: true })

  watch(
    isDark,
    (dark) => {
      document.documentElement.classList.toggle('dark', dark)
      monaco.setTheme((dark ? 'dark' : 'light') satisfies PlaygroundTheme)
    },
    { immediate: true },
  )

  watch(
    html,
    (content, _previousContent, onCleanup) => {
      const revision = ++currentRevision
      status.value = 'generating'
      errorMessage.value = ''

      const timeout = window.setTimeout(async () => {
        try {
          const css = await monaco.generateStyles(content)
          if (revision !== currentRevision)
            return

          artifact.value = { css, html: content }
          status.value = 'ready'
        }
        catch (error) {
          if (revision !== currentRevision)
            return

          errorMessage.value = error instanceof Error ? error.message : String(error)
          status.value = 'error'
        }
      }, generationDelay)

      onCleanup(() => window.clearTimeout(timeout))
    },
    { immediate: true },
  )

  const css = computed(() => artifact.value?.css ?? '')
  const previewDocument = computed(() => buildPreviewDocument(artifact.value?.html ?? initialDocument, isDark.value))
  const statusPresentation = computed<StatusPresentation>(() => {
    switch (status.value) {
      case 'generating':
        if (!showBusy.value && artifact.value) {
          return {
            cssDetail: formatByteCount(artifact.value.css),
            tone: 'muted',
          }
        }
        return {
          cssDetail: 'Generating CSS',
          tone: 'active',
        }
      case 'error':
        return {
          cssDetail: errorMessage.value || 'Generation failed',
          tone: 'danger',
        }
      case 'ready':
        return {
          cssDetail: formatByteCount(artifact.value?.css ?? ''),
          tone: 'muted',
        }
    }
  })
  const cssDetail = computed(() => statusPresentation.value.cssDetail)
  const statusTone = computed(() => statusPresentation.value.tone)

  return {
    css,
    cssDetail,
    html,
    isDark: readonly(isDark),
    previewDocument,
    statusTone,
    toggleTheme() {
      isDark.value = !isDark.value
    },
  }
}
