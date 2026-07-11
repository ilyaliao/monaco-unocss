import type { SourceCodeTransformer, UnocssPluginContext, UnoGenerator } from '@unocss/core'
import { BetterMap, escapeRegExp } from '@unocss/core'
import MagicString from 'magic-string'
import { IGNORE_COMMENT, SKIP_COMMENT_RE } from '../vendor/constants'

const transformerEnforceOrder = ['pre', 'default', 'post'] as const

export interface SourceTransformerRunResult {
  code: string
  ignored: boolean
}

function shouldTransform(
  transformer: SourceCodeTransformer,
  code: string,
  id: string,
): boolean {
  if (transformer.idFilter && !transformer.idFilter(id))
    return false

  return transformer.codeFilter?.(code, id) ?? true
}

export function withoutSkippedSource(code: string): string {
  return code.replace(
    SKIP_COMMENT_RE,
    skipped => skipped.replace(/[^\n\r\u2028\u2029]/g, ' '),
  )
}

function createTransformerContext(
  uno: UnoGenerator,
  tokens: Set<string>,
): UnocssPluginContext {
  const modules = new BetterMap<string, string>()
  const affectedModules = new Set<string>()
  const tasks: UnocssPluginContext['tasks'] = []
  const invalidations = new Set<() => void>()
  const reloadListeners = new Set<() => void>()
  const configResult = { config: uno.userConfig, sources: [] }
  const context: UnocssPluginContext = {
    affectedModules,
    async extract(code, id) {
      if (id)
        modules.set(id, code)
      await uno.applyExtractors(withoutSkippedSource(code), id, tokens)
    },
    filter: code => !code.includes(IGNORE_COMMENT),
    async flushTasks() {
      const pending = [...tasks]
      await Promise.all(pending)
      tasks.splice(0, pending.length)
    },
    getConfig: async () => uno.userConfig,
    getConfigFileList: () => [],
    async getVMPRegexes() {
      const prefix = uno.config.virtualModulePrefix ?? '__uno'
      const escapedPrefix = escapeRegExp(prefix)

      return {
        prefix,
        RESOLVED_ID_RE: new RegExp(`[/\\\\]${escapedPrefix}(?:_(.*?))?\\.css$`),
        RESOLVED_ID_WITH_QUERY_RE: new RegExp(`[/\\\\]${escapedPrefix}(?:_.*?)?\\.css(?:\\?.*)?$`),
      }
    },
    invalidate() {
      invalidations.forEach(listener => listener())
    },
    modules,
    onInvalidate(listener) {
      invalidations.add(listener)
    },
    onReload(listener) {
      reloadListeners.add(listener)
    },
    ready: Promise.resolve(configResult),
    async reloadConfig() {
      reloadListeners.forEach(listener => listener())
      return configResult
    },
    root: '',
    tasks,
    tokens,
    uno,
    async updateRoot(root) {
      context.root = root
      return configResult
    },
  }

  return context
}

export function createSourceTransformerRunner(
  uno: UnoGenerator,
  tokens: Set<string>,
): (code: string, id: string) => Promise<SourceTransformerRunResult> {
  const context = createTransformerContext(uno, tokens)

  return async (code, id) => {
    if (code.includes(IGNORE_COMMENT)) {
      return {
        code,
        ignored: true,
      }
    }

    let transformedCode = withoutSkippedSource(code)

    for (const enforce of transformerEnforceOrder) {
      const transformers = uno.config.transformers
        ?.filter(transformer => (transformer.enforce ?? 'default') === enforce)
        ?? []

      for (const transformer of transformers) {
        if (!shouldTransform(transformer, transformedCode, id))
          continue

        const transformed = new MagicString(transformedCode)
        await transformer.transform(transformed, id, context)
        transformedCode = transformed.toString()
      }
    }

    await context.flushTasks()

    return {
      code: transformedCode,
      ignored: false,
    }
  }
}
