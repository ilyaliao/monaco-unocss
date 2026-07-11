// @env node
import { presetWind3 } from 'unocss'
import { describe, expect, it } from 'vitest'
import { Range } from 'vscode-languageserver-protocol'
import { createDocumentSessionFactory } from '../src/worker/document-session'
import { doHover } from '../src/worker/hover'

describe('hover in strings with escaped delimiters', () => {
  it.each([
    ['double quote', 'const x = "prefix \\" mt-2"'],
    ['single quote', 'const x = \'prefix \\\' mt-2\''],
    ['backtick', 'const x = `prefix \\` mt-2`'],
  ])('finds a utility after an escaped %s', async (_, source) => {
    const uri = 'file:///escaped-quotes.ts'
    const factory = createDocumentSessionFactory(
      () => [{ getValue: () => source, uri, version: 0 }],
      { presets: [presetWind3()] },
    )
    const session = factory.resolveDocument(uri, 'typescript')!
    const start = source.indexOf('mt-2')

    const hover = await doHover(
      session,
      session.document.positionAt(start + 1),
    )

    expect(hover?.range).toEqual(Range.create(
      session.document.positionAt(start),
      session.document.positionAt(start + 'mt-2'.length),
    ))
  })
})
