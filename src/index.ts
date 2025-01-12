import type { UserConfig } from '@unocss/core'
import type { ConfigureMonacoUnocss, MonacoUnocssOptions } from './types/configure'
import type { UnocssWorker } from './types/worker'
import { registerMarkerDataProvider } from 'monaco-marker-data-provider'
import { createWorkerManager } from 'monaco-worker-manager'
import {
  createCodeActionProvider,
  createColorProvider,
  createCompletionItemProvider,
  createHoverProvider,
  createMarkerDataProvider,
} from './languageFeatures'

export const defaultLanguageSelector = ['css', 'javascript', 'html', 'mdx', 'typescript'] as const

export const configureMonacoUnocss: ConfigureMonacoUnocss
  = (monaco, { languageSelector = defaultLanguageSelector, unocssConfig } = {}) => {
    // eslint-disable-next-line no-console
    console.log('test', languageSelector, unocssConfig)

    const workerManager = createWorkerManager<UnocssWorker, MonacoUnocssOptions>(monaco, {
      label: 'unocss',
      moduleId: 'monaco-unocss/unocss.worker',
      createData: { unocssConfig },
    })

    const disposables = [
      workerManager,
      monaco.languages.registerCodeActionProvider(
        languageSelector,
        createCodeActionProvider(workerManager.getWorker),
      ),
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

    // Monaco editor doesn’t provide a function to match language selectors, so let’s just support
    // strings here.
    for (const language of Array.isArray(languageSelector)
      ? languageSelector
      : [languageSelector]) {
      if (typeof language === 'string') {
        disposables.push(
          registerMarkerDataProvider(
            monaco,
            language,
            createMarkerDataProvider(workerManager.getWorker),
          ),
        )
      }
    }

    return {
      dispose() {
        for (const disposable of disposables) {
          disposable.dispose()
        }
      },

      setUnocssConfig: (newUnocssConfig: UserConfig | string) => {
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
