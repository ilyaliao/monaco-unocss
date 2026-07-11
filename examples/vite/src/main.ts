// @env browser
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker.js?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker.js?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker'
import { configureMonacoUnocss } from 'monaco-unocss'

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
        return new Worker(new URL('unocss.worker.ts', import.meta.url), {
          type: 'module',
        })
      default:
        throw new Error(`Unknown label ${label}`)
    }
  },
}

const monacoUnocss = configureMonacoUnocss(monaco)

const editor = monaco.editor.create(document.getElementById('app')!, {
  automaticLayout: true,
  language: 'html',
  value: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <div class="w-6 w-6 h-6 float-left text-gray-600 bg-[#ff8888] bg-[hotpink] hover:(text-sky-600 bg-sky-50) ring-gray-900/5">123</div>
    <div text="red-5" p="x-4">attributify</div>
  </body>
</html>
`,
})

monacoUnocss
  .generateStylesFromContent(['<div class="hover:(mt-4 text-red-5)"></div>'], { preflights: false })
  .then((css) => {
    // eslint-disable-next-line no-console
    console.log('[monaco-unocss] generateStylesFromContent:', css)
  })

Object.assign(window, { editor, monaco, monacoUnocss })
