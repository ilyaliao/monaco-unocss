// @env worker
import type { MonacoUnocssOptions, UnocssWorkerOptions } from './types/configure'
import type { UnocssWorker } from './types/worker'
import type { DocumentSession } from './worker/document-session'
import { initialize as initializeWorker } from 'monaco-editor/esm/vs/common/initialize.js'
import { getDocumentColors as getDocumentColorsForDocument } from './worker/colors'
import { doComplete, resolveCompletionItem } from './worker/complete'
import { runDocumentLayerFeature } from './worker/document-feature-result'
import { createDocumentSessionFactory } from './worker/document-session'
import { generateStylesFromContent } from './worker/generate-styles'
import { doHover } from './worker/hover'

export type { UnocssWorkerOptions } from './types/configure'

export function initialize(unocssWorkerOptions?: UnocssWorkerOptions): void {
  globalThis.onmessage = () => initializeWorker<UnocssWorker, MonacoUnocssOptions>((ctx, options) => {
    const preparedUnocssConfig
      = unocssWorkerOptions?.prepareUnocssConfig?.(options.unocssConfig)
        ?? options.unocssConfig
        ?? {}
    if (typeof preparedUnocssConfig !== 'object') {
      throw new TypeError(
        `Expected unocssConfig to resolve to an object, but got: ${JSON.stringify(
          preparedUnocssConfig,
        )}`,
      )
    }

    const sessionFactory = createDocumentSessionFactory(
      () => ctx.getMirrorModels(),
      preparedUnocssConfig,
    )

    const withSession
      = <A extends unknown[], R>(
        fn: (session: DocumentSession, ...args: A) => R | Promise<R>,
      ) =>
        async (uri: string, languageId: string, ...args: A): Promise<Awaited<R> | undefined> => {
          const session = sessionFactory.resolveDocument(uri, languageId)
          if (session)
            return await fn(session, ...args)
        }

    return {
      doComplete: withSession(doComplete),

      doHover: withSession(doHover),

      generateStylesFromContent: (content, options) =>
        generateStylesFromContent(sessionFactory, content, options),

      getDocumentColors: (uri, languageId) => runDocumentLayerFeature(
        sessionFactory.resolveDocument(uri, languageId),
        getDocumentColorsForDocument,
      ),

      resolveCompletionItem: item => resolveCompletionItem(sessionFactory, item),
    }
  })
}

// Register the default worker endpoint for direct worker imports.
initialize()
