// @env browser
import type { editor } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker.js?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker.js?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker'
import { configureMonacoUnocss } from 'monaco-unocss'

export type PlaygroundTheme = 'light' | 'dark'

export interface CreateEditorOptions {
  ariaLabel: string
  element: HTMLElement
  language: 'css' | 'html'
  readOnly?: boolean
  value: string
}

export interface PlaygroundMonaco {
  createEditor: (options: CreateEditorOptions) => editor.IStandaloneCodeEditor
  dispose: () => void
  generateStyles: (content: string) => Promise<string>
  setTheme: (theme: PlaygroundTheme) => void
}

function readThemeColor(property: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim()
  if (!value) {
    throw new Error(`Missing playground theme color: ${property}`)
  }

  return value
}

function definePlaygroundTheme(theme: PlaygroundTheme): string {
  const name = `monaco-unocss-${theme}`
  monaco.editor.defineTheme(name, {
    base: theme === 'dark' ? 'vs-dark' : 'vs',
    colors: {
      'editor.background': readThemeColor('--color-editor-bg'),
      'editor.foreground': readThemeColor('--color-text-base'),
      'editor.lineHighlightBackground': readThemeColor('--color-editor-line-highlight'),
      'editor.selectionBackground': readThemeColor('--color-editor-selection'),
      'editorCursor.foreground': readThemeColor('--color-accent'),
      'editorGutter.background': readThemeColor('--color-editor-bg'),
      'editorIndentGuide.activeBackground1': readThemeColor('--color-editor-active-indent'),
      'editorIndentGuide.background1': readThemeColor('--color-editor-indent'),
      'editorLineNumber.activeForeground': readThemeColor('--color-editor-line-active'),
      'editorLineNumber.foreground': readThemeColor('--color-editor-line-number'),
      'editorOverviewRuler.border': readThemeColor('--color-border-base'),
      'editorWidget.background': readThemeColor('--color-bg-secondary'),
      'editorWidget.border': readThemeColor('--color-border-base'),
      'scrollbarSlider.activeBackground': readThemeColor('--color-editor-scrollbar-active'),
      'scrollbarSlider.background': readThemeColor('--color-editor-scrollbar'),
      'scrollbarSlider.hoverBackground': readThemeColor('--color-editor-scrollbar-hover'),
    },
    inherit: true,
    rules: [],
  })
  return name
}

function configureMonacoEnvironment(): void {
  window.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      switch (label) {
        case 'editorWorkerService':
          return new EditorWorker()
        case 'css':
        case 'scss':
        case 'less':
          return new CssWorker()
        case 'html':
        case 'handlebars':
        case 'razor':
          return new HtmlWorker()
        case 'typescript':
        case 'javascript':
          return new TsWorker()
        case 'unocss':
          return new Worker(new URL('./unocss.worker.ts', import.meta.url), {
            type: 'module',
          })
        default:
          throw new Error(`Unknown Monaco worker label: ${label}`)
      }
    },
  }
}

function getEditorOptions(
  ariaLabel: string,
  wordWrap: editor.IStandaloneEditorConstructionOptions['wordWrap'],
): editor.IStandaloneEditorConstructionOptions {
  return {
    ariaLabel,
    automaticLayout: true,
    fixedOverflowWidgets: true,
    folding: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontLigatures: true,
    fontSize: 13,
    lineHeight: 21,
    lineNumbersMinChars: 3,
    minimap: { enabled: false },
    overviewRulerBorder: false,
    padding: { bottom: 12, top: 12 },
    renderLineHighlight: 'all',
    renderValidationDecorations: 'on',
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    scrollbar: {
      horizontalScrollbarSize: 10,
      useShadows: false,
      verticalScrollbarSize: 10,
    },
    smoothScrolling: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    stickyScroll: { enabled: false },
    tabSize: 2,
    wordWrap,
  }
}

function nameEditorTextareas(element: HTMLElement, ariaLabel: string): void {
  const fieldName = ariaLabel.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
  for (const textArea of element.querySelectorAll('textarea:not([name])'))
    textArea.setAttribute('name', fieldName)
}

function createEditor(options: CreateEditorOptions): editor.IStandaloneCodeEditor {
  const instance = monaco.editor.create(options.element, {
    ...getEditorOptions(options.ariaLabel, options.language === 'css' ? 'on' : 'off'),
    language: options.language,
    readOnly: options.readOnly,
    value: options.value,
  })

  nameEditorTextareas(options.element, options.ariaLabel)

  return instance
}

export function createPlaygroundMonaco(): PlaygroundMonaco {
  configureMonacoEnvironment()

  const editors = new Set<editor.IStandaloneCodeEditor>()
  const monacoUnocss = configureMonacoUnocss(monaco)

  return {
    createEditor(options) {
      const instance = createEditor(options)
      editors.add(instance)
      instance.onDidDispose(() => editors.delete(instance))
      return instance
    },

    dispose() {
      for (const instance of editors) {
        instance.dispose()
      }
      editors.clear()
      monacoUnocss.dispose()
    },

    generateStyles(content) {
      return monacoUnocss.generateStylesFromContent([
        { content, extension: 'html' },
      ])
    },

    setTheme(theme) {
      monaco.editor.setTheme(definePlaygroundTheme(theme))
    },
  }
}
