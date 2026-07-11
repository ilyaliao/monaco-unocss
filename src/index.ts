// @env browser
import type { UserConfig } from '@unocss/core'
import type { editor, IDisposable, Uri } from 'monaco-types'
import type {
  ConfigureMonacoUnocss,
  MonacoUnocssMonacoEditor,
  MonacoUnocssOptions,
} from './types/configure'
import type { UnocssWorker } from './types/worker'
import {
  createColorProvider,
  createCompletionItemProvider,
  createHoverProvider,
} from './languageFeatures'

export const defaultLanguageSelector = ['css', 'javascript', 'html', 'mdx', 'typescript'] as const

function getCreateWebWorker(monaco: MonacoUnocssMonacoEditor): MonacoUnocssMonacoEditor['createWebWorker'] {
  const { createWebWorker } = monaco

  if (typeof createWebWorker !== 'function') {
    throw new TypeError('monaco-unocss requires monaco.createWebWorker from monaco-editor')
  }

  return createWebWorker
}

export const configureMonacoUnocss: ConfigureMonacoUnocss
  = (monaco, { languageSelector = defaultLanguageSelector, unocssConfig } = {}) => {
    const createWebWorker = getCreateWebWorker(monaco)
    let createData: MonacoUnocssOptions = { unocssConfig }
    let worker: editor.MonacoWebWorker<UnocssWorker> | undefined

    const disposeWorker = (): void => {
      worker?.dispose()
      worker = undefined
    }

    const getWorker = (...resources: Uri[]): Promise<UnocssWorker> => {
      worker ??= createWebWorker<UnocssWorker>({
        createData,
        label: 'unocss',
        moduleId: 'monaco-unocss/unocss.worker',
      })

      return worker.withSyncedResources(resources)
    }

    const workerDisposable: IDisposable = {
      dispose: disposeWorker,
    }

    const disposables = [
      workerDisposable,
      monaco.languages.registerColorProvider(
        languageSelector,
        createColorProvider(monaco, getWorker),
      ),
      monaco.languages.registerCompletionItemProvider(
        languageSelector,
        createCompletionItemProvider(getWorker),
      ),
      monaco.languages.registerHoverProvider(
        languageSelector,
        createHoverProvider(getWorker),
      ),
    ]

    return {
      dispose() {
        for (const disposable of disposables) {
          disposable.dispose()
        }
      },

      setUnocssConfig: (newUnocssConfig: UserConfig) => {
        createData = { unocssConfig: newUnocssConfig }
        disposeWorker()
      },

      async generateStylesFromContent(contents, options) {
        const client = await getWorker()

        return client.generateStylesFromContent(
          contents.map(content => (typeof content === 'string' ? { content } : content)),
          options,
        )
      },
    }
  }
