import type { SourceCodeTransformer, UnoGenerator } from '@unocss/core'
import type { Content, GenerateStylesFromContentOptions } from '../types/configure'
import type { DocumentSessionFactory } from './document-session'
import MagicString from 'magic-string'

const transformerEnforceOrder = ['pre', 'default', 'post'] as const

class UnoGeneratorInitializationError extends Error {
  override name = 'UnoGeneratorInitializationError'

  constructor(cause: unknown) {
    const message = 'Unable to generate styles because the UnoCSS generator failed to initialize'
    const causeMessage = cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
        ? cause
        : undefined

    super(causeMessage ? `${message}: ${causeMessage}` : message, { cause })
  }
}

function contentIdForExtension(extension: string | undefined): string | undefined {
  const normalized = extension?.trim().replace(/^\./, '')

  if (!normalized)
    return undefined

  return `monaco-unocss-content.${normalized}`
}

function normalizeContent(content: Content | string): Content {
  return typeof content === 'string' ? { content } : content
}

function shouldTransform(transformer: SourceCodeTransformer, code: string, id: string): boolean {
  if (transformer.idFilter && !transformer.idFilter(id))
    return false

  return transformer.codeFilter?.(code, id) ?? true
}

async function applyTransformers(
  uno: UnoGenerator<object>,
  code: string,
  id: string,
  tokens: Set<string>,
): Promise<string> {
  const transformers = uno.config.transformers ?? []

  if (transformers.length === 0)
    return code

  const transformed = new MagicString(code)
  const context = {
    invalidate() {},
    tokens,
    uno,
  } as Parameters<SourceCodeTransformer['transform']>[2]

  for (const enforce of transformerEnforceOrder) {
    for (const transformer of transformers.filter(i => (i.enforce ?? 'default') === enforce)) {
      if (shouldTransform(transformer, transformed.toString(), id))
        await transformer.transform(transformed, id, context)
    }
  }

  return transformed.toString()
}

export async function generateStylesFromContent(
  factory: DocumentSessionFactory,
  contents: (Content | string)[],
  options?: GenerateStylesFromContentOptions,
): Promise<string> {
  const generatorResult = await factory.getGeneratorResult()
  if ('cause' in generatorResult) {
    throw new UnoGeneratorInitializationError(generatorResult.cause)
  }
  const uno = generatorResult.generator

  const tokens = new Set<string>()

  for (const content of contents) {
    const entry = normalizeContent(content)
    const extractorId = contentIdForExtension(entry.extension)
    const transformedContent = await applyTransformers(
      uno,
      entry.content,
      extractorId ?? 'monaco-unocss-content',
      tokens,
    )

    await uno.applyExtractors(
      transformedContent,
      extractorId,
      tokens,
    )
  }

  const { css } = await uno.generate(tokens, options)

  return css
}
