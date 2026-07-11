import type { SourceCodeTransformer, UnoGenerator } from '@unocss/core'
import type { Content, GenerateStylesFromContentOptions } from '../types/configure'
import MagicString from 'magic-string'

const transformerEnforceOrder = ['pre', 'default', 'post'] as const

type SourceCodeTransformerWithCodeFilter = SourceCodeTransformer & {
  codeFilter?: (code: string, id: string) => boolean
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

  const { codeFilter } = transformer as SourceCodeTransformerWithCodeFilter
  return codeFilter?.(code, id) ?? true
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
  generator: Promise<UnoGenerator<object>>,
  contents: (Content | string)[],
  options?: GenerateStylesFromContentOptions,
): Promise<string> {
  const uno = await generator
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
