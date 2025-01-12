import type { UserConfig } from 'unocss'
import type {
  CodeActionContext,
  CompletionContext,
  CompletionItem,
  Position,
  Range,
} from 'vscode-languageserver-protocol'
import type { MonacoUnocssOptions, UnocssConfig, UnocssWorkerOptions } from './types'
import { initialize as initializeWorker } from 'monaco-worker-manager/worker'
import { TextDocument } from 'vscode-languageserver-textdocument'

export interface UnocssWorker {
  doCodeActions: (
    uri: string,
    languageId: string,
    range: Range,
    context: CodeActionContext
  ) => undefined

  doComplete: (
    uri: string,
    languageId: string,
    position: Position,
    context: CompletionContext
  ) => undefined

  doHover: (uri: string, languageId: string, position: Position) => undefined

  doValidate: (uri: string, languageId: string) => undefined

  generateStylesFromContent: (css: string, content: any[]) => string

  getDocumentColors: (uri: string, languageId: string) => undefined

  resolveCompletionItem: (item: CompletionItem) => undefined
}

async function stateFromConfig(
  configPromise: PromiseLike<UnocssConfig> | UnocssConfig,
): Promise<any> {
  // eslint-disable-next-line no-console
  console.log('stateFromConfig', configPromise)
  return {}
}

export function initialize(unocssWorkerOptions?: UnocssWorkerOptions): void {
  // eslint-disable-next-line no-console
  console.log('initialize unocss worker', JSON.stringify(unocssWorkerOptions))
  initializeWorker<UnocssWorker, MonacoUnocssOptions>((ctx, options) => {
    const preparedUnocssConfig
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

    const statePromise = stateFromConfig(preparedUnocssConfig)

    const withDocument
      = <A extends unknown[], R>(
        fn: (state: any, document: TextDocument, ...args: A) => any,
      ) =>
        (uri: string, languageId: string, ...args: A): Promise<R> | undefined => {
          const models = ctx.getMirrorModels()
          for (const model of models) {
            if (String(model.uri) === uri) {
              return statePromise.then(state =>
                fn(
                  state,
                  TextDocument.create(uri, languageId, model.version, model.getValue()),
                  ...args,
                ),
              )
            }
          }
        }

    return {
      doCodeActions: withDocument((_state, _textDocument, _range, _context) =>
        // doCodeActions(state, { range, context, textDocument }, textDocument),
        undefined,
      ),

      doComplete: withDocument(() => undefined),

      doHover: withDocument(() => undefined),

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
