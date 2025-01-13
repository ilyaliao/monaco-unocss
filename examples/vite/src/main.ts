import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import { configureMonacoUnocss } from 'monaco-unocss'

configureMonacoUnocss(monaco)

window.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    switch (label) {
      case 'editorWorkerService':
        return new EditorWorker()
      case 'unocss':
        return new Worker(new URL('unocss.worker.ts', import.meta.url), {
          type: 'module',
        })
      default:
        throw new Error(`Unknown label ${label}`)
    }
  },
}

monaco.editor.create(document.getElementById('app')!, {
  automaticLayout: true,
  language: 'html',
  value: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <div class="w-6 w-6 h-6 text-gray-600 bg-[#ff8888] hover:text-sky-600 ring-gray-900/5">123</div>
  </body>
</html>
`,
})
