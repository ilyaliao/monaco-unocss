import type { Content, GenerateStylesFromContentOptions } from '../types/configure'
import type { DocumentSessionFactory } from './document-session'
import {
  createSourceTransformerRunner,
  withoutSkippedSource,
} from './source-transformers'

const fallbackContentId = 'monaco-unocss-content'

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

  return `${fallbackContentId}.${normalized}`
}

export async function generateStylesFromContent(
  factory: DocumentSessionFactory,
  contents: Content[],
  options?: GenerateStylesFromContentOptions,
): Promise<string> {
  const generatorResult = await factory.getGeneratorResult()
  if ('cause' in generatorResult) {
    throw new UnoGeneratorInitializationError(generatorResult.cause)
  }
  const uno = generatorResult.generator

  const tokens = new Set<string>()
  const transformSource = createSourceTransformerRunner(uno, tokens)

  for (const entry of contents) {
    const extractorId = contentIdForExtension(entry.extension)
    const transformed = await transformSource(
      entry.content,
      extractorId ?? fallbackContentId,
    )

    if (transformed.ignored)
      continue

    await uno.applyExtractors(
      withoutSkippedSource(transformed.code),
      extractorId,
      tokens,
    )
  }

  const { css } = await uno.generate(tokens, options)

  return css
}
