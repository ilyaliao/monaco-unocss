import type { UnoGenerator, UserConfig, UserConfigDefaults } from '@unocss/core'
import type { MonacoUnocssOptions, UnocssWorkerOptions } from './types/configure'
import type { UnocssWorker } from './types/worker'
import { createAutocomplete } from '@unocss/autocomplete'
import { createGenerator } from '@unocss/core'
import { initialize as initializeWorker } from 'monaco-worker-manager/worker'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getDocumentColors as getDocumentColorsForDocument } from './worker/colors'
import { doComplete, resolveCompletionItem } from './worker/complete'
import { doHover } from './worker/hover'
import { pruneMatchedPositionsCache } from './worker/matched-positions-cache'

async function generatorConfig(configPromise: PromiseLike<UserConfig> | UserConfig, defaultConfig: UserConfigDefaults): Promise<UnoGenerator<object>> {
  const preparedUnocssConfig = await configPromise
  return await createGenerator(preparedUnocssConfig, defaultConfig)
}

export function initialize(unocssWorkerOptions?: UnocssWorkerOptions): void {
  initializeWorker<UnocssWorker, MonacoUnocssOptions>((ctx, options) => {
    const preparedUnocssConfig: UserConfig | PromiseLike<UserConfig>
      = unocssWorkerOptions?.prepareUnocssConfig?.(options.unocssConfig)
        ?? options.unocssConfig
        ?? ({} as UserConfig)
    if (typeof preparedUnocssConfig !== 'object') {
      throw new TypeError(
        `Expected unocssConfig to resolve to an object, but got: ${JSON.stringify(
          preparedUnocssConfig,
        )}`,
      )
    }

    const defaultUnocssConfig: UserConfigDefaults = {}

    const __uno = generatorConfig(preparedUnocssConfig, defaultUnocssConfig)
    const autocomplete = createAutocomplete(__uno)

    const withDocument
      = <A extends unknown[], R>(
        fn: (document: TextDocument, ...args: A) => R | Promise<R>,
      ) =>
        async (uri: string, languageId: string, ...args: A): Promise<Awaited<R> | undefined> => {
          const models = ctx.getMirrorModels()
          pruneMatchedPositionsCache(models.map(model => String(model.uri)))
          for (const model of models) {
            if (String(model.uri) === uri) {
              const result = await fn(
                TextDocument.create(uri, languageId, model.version, model.getValue()),
                ...args,
              )
              return result
            }
          }
        }

    return {
      doComplete: withDocument((document, position) => doComplete(document, position, autocomplete)),

      doHover: withDocument((document, position) => doHover(document, position, __uno)),

      async generateStylesFromContent(css, content) {
        // eslint-disable-next-line no-console
        console.log('generateStylesFromContent', css, content)
        return ''
      },

      getDocumentColors: withDocument(document => getDocumentColorsForDocument(document, __uno)),

      async resolveCompletionItem(item) {
        return resolveCompletionItem(item, __uno)
      },
    }
  })
}

// Side effect initialization - but this function can be called more than once. Last applies.
initialize()
