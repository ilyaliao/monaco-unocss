import type { UserConfig } from '@unocss/core'
import type { ConfigureMonacoUnocss, MonacoUnocssOptions } from './types/configure'
import type { UnocssWorker } from './types/worker'
import { createWorkerManager } from 'monaco-worker-manager'
import {
  createColorProvider,
  createCompletionItemProvider,
  createHoverProvider,
} from './languageFeatures'

export const defaultLanguageSelector = ['css', 'javascript', 'html', 'mdx', 'typescript'] as const

export const configureMonacoUnocss: ConfigureMonacoUnocss
  = (monaco, { languageSelector = defaultLanguageSelector, unocssConfig } = {}) => {
    const workerManager = createWorkerManager<UnocssWorker, MonacoUnocssOptions>(monaco, {
      label: 'unocss',
      moduleId: 'monaco-unocss/unocss.worker',
      createData: { unocssConfig },
    })

    const disposables = [
      workerManager,
      monaco.languages.registerColorProvider(
        languageSelector,
        createColorProvider(monaco, workerManager.getWorker),
      ),
      monaco.languages.registerCompletionItemProvider(
        languageSelector,
        createCompletionItemProvider(workerManager.getWorker),
      ),
      monaco.languages.registerHoverProvider(
        languageSelector,
        createHoverProvider(workerManager.getWorker),
      ),
    ]

    return {
      dispose() {
        for (const disposable of disposables) {
          disposable.dispose()
        }
      },

      setUnocssConfig: (newUnocssConfig: UserConfig) => {
        workerManager.updateCreateData({ unocssConfig: newUnocssConfig })
      },

      async generateStylesFromContent(css, contents) {
        const client = await workerManager.getWorker()

        return client.generateStylesFromContent(
          css,
          contents.map(content => (typeof content === 'string' ? { content } : content)),
        )
      },
    }
  }
