import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import { configureMonacoUnocss } from 'monaco-unocss'
import UnocssWorker from 'monaco-unocss/unocss.worker?worker'

window.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    switch (label) {
      case 'editorWorkerService':
        return new EditorWorker()
      case 'unocss':
        return new UnocssWorker()
      default:
        throw new Error(`Unknown label ${label}`)
    }
  },
}

configureMonacoUnocss(monaco, {})

monaco.editor.create(document.getElementById('editor'), {
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
