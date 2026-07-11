// @env browser
import type { editor, IDisposable, Uri } from 'monaco-types'
import type {
  ConfigureMonacoUnocss,
  MonacoUnocssMonacoEditor,
  UnocssConfig,
  UnocssWorkerCreateData,
} from './types/configure'
import type { UnocssWorker } from './types/worker'
import {
  createColorProvider,
  createCompletionItemProvider,
  createHoverProvider,
} from './languageFeatures'
import {
  createWorkerGeneration,
  createWorkerGenerationClient,
} from './worker-generation'

export type { UnocssConfig } from './types/configure'

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
    let createData: UnocssWorkerCreateData = { unocssConfig }
    let disposed = false
    let worker: editor.MonacoWebWorker<UnocssWorker> | undefined
    let workerGeneration: ReturnType<typeof createWorkerGeneration> | undefined

    const assertNotDisposed = (): void => {
      if (disposed)
        throw new Error('monaco-unocss integration has been disposed')
    }

    const disposeWorker = (): void => {
      workerGeneration?.invalidate()
      worker?.dispose()
      workerGeneration = undefined
      worker = undefined
    }

    const getWorker = (...resources: Uri[]): Promise<UnocssWorker> => {
      assertNotDisposed()

      worker ??= createWebWorker<UnocssWorker>({
        createData,
        label: 'unocss',
        moduleId: 'monaco-unocss/unocss.worker',
      })
      const generation = workerGeneration ??= createWorkerGeneration()

      return Promise.resolve(createWorkerGenerationClient(
        worker.withSyncedResources(resources),
        generation,
      ))
    }

    const workerDisposable: IDisposable = {
      dispose: disposeWorker,
    }

    const colorProvider = createColorProvider(monaco, getWorker)
    let colorProviderRegistration = monaco.languages.registerColorProvider(
      languageSelector,
      colorProvider,
    )
    const colorProviderDisposable: IDisposable = {
      dispose() {
        colorProviderRegistration.dispose()
      },
    }
    const refreshColorProvider = (): void => {
      colorProvider.reset()
      colorProviderRegistration.dispose()
      colorProviderRegistration = monaco.languages.registerColorProvider(
        languageSelector,
        colorProvider,
      )
    }

    const disposables = [
      workerDisposable,
      colorProviderDisposable,
      colorProvider,
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
        if (disposed)
          return

        disposed = true
        for (const disposable of disposables) {
          disposable.dispose()
        }
      },

      async setUnocssConfig(newUnocssConfig: UnocssConfig) {
        assertNotDisposed()
        createData = { unocssConfig: newUnocssConfig }
        disposeWorker()
        refreshColorProvider()
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
