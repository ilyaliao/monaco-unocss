import type { UnoGenerator, UserConfig, UserConfigDefaults } from '@unocss/core'
import type { MonacoUnocssOptions, UnocssWorkerOptions } from './types/configure'
import type { UnocssWorker } from './types/worker'
import { createAutocomplete } from '@unocss/autocomplete'
import { createGenerator } from '@unocss/core'
import { initialize as initializeWorker } from 'monaco-worker-manager/worker'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { doComplete } from './worker/complete'
import { doHover } from './worker/hover'

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

    const generator = generatorConfig(preparedUnocssConfig, defaultUnocssConfig)
    const autocomplete = createAutocomplete(generator)

    const withDocument
      = <A extends unknown[], R>(
        fn: (document: TextDocument, ...args: A) => any,
      ) =>
        (uri: string, languageId: string, ...args: A): Promise<R> | undefined => {
          const models = ctx.getMirrorModels()
          for (const model of models) {
            if (String(model.uri) === uri) {
              return fn(
                TextDocument.create(uri, languageId, model.version, model.getValue()),
                ...args,
              )
            }
          }
        }

    return {
      doCodeActions: withDocument((_textDocument, _range, _context) =>
        // doCodeActions(state, { range, context, textDocument }, textDocument),
        undefined,
      ),

      doComplete: withDocument((document, position) => doComplete(document, position, autocomplete)),

      doHover: withDocument((document, position) => doHover(document, position, generator)),

      doValidate: withDocument(() => undefined),

      async generateStylesFromContent(css, content) {
        // eslint-disable-next-line no-console
        console.log('generateStylesFromContent', css, content)
        return ''
      },

      getDocumentColors: withDocument(() => undefined),

      async resolveCompletionItem(item) {
        // eslint-disable-next-line no-console
        console.log('resolveCompletionItem', item)
        return undefined
      },
    }
  })
}

// Side effect initialization - but this function can be called more than once. Last applies.
initialize()
