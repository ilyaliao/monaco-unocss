import type { UnoGenerator } from '@unocss/core'
import { createGenerator } from '@unocss/core'
import { presetAttributify, presetWind3 } from 'unocss'
import { describe, expect, it } from 'vitest'
import { Range } from 'vscode-languageserver-protocol'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { doHover } from '../src/worker/hover'

function createDocument(source: string): TextDocument {
  return TextDocument.create('file:///fixture.html', 'html', 0, source)
}

function positionInside(document: TextDocument, source: string, needle: string) {
  const index = source.indexOf(needle)
  if (index < 0)
    throw new Error(`Missing test needle: ${needle}`)

  return document.positionAt(index + Math.floor(needle.length / 2))
}

function rangeFor(document: TextDocument, source: string, needle: string) {
  const index = source.indexOf(needle)
  if (index < 0)
    throw new Error(`Missing test needle: ${needle}`)

  return Range.create(
    document.positionAt(index),
    document.positionAt(index + needle.length),
  )
}

function createUno({ attributify = false } = {}): Promise<UnoGenerator> {
  return createGenerator({
    presets: [
      presetWind3(),
      ...(attributify ? [presetAttributify()] : []),
    ],
  })
}

describe('doHover', () => {
  it('returns prettied CSS and the matched range for a utility', async () => {
    const source = '<div class="text-red-5"></div>'
    const document = createDocument(source)

    const hover = await doHover(
      document,
      positionInside(document, source, 'text-red-5'),
      createUno(),
    )

    expect(hover?.range).toEqual(rangeFor(document, source, 'text-red-5'))
    expect(hover?.contents).toMatchObject({
      kind: 'markdown',
      value: expect.stringContaining('--un-text-opacity: 1;'),
    })
    expect(hover?.contents).toMatchObject({
      value: expect.stringContaining('color: rgb(239 68 68 / var(--un-text-opacity));'),
    })
    expect(hover?.contents).toMatchObject({
      value: expect.stringContaining('```css\n'),
    })
  })

  it.each([
    ['tag name', '<div class="text-red-5"></div>', 'div'],
    ['random word', '<div class="text-red-5">random</div>', 'random'],
    ['unmatched class', '<div class="not-a-utility"></div>', 'not-a-utility'],
  ])('returns undefined on non-utility text: %s', async (_, source, needle) => {
    const document = createDocument(source)

    await expect(
      doHover(document, positionInside(document, source, needle), createUno()),
    ).resolves.toBeUndefined()
  })

  it.each([
    ['offset 0', '<div class="text-red-5"></div>', 0],
    ['inside an opening tag before any utility', '<div class="text-red-5"></div>', 2],
  ])('returns undefined instead of throwing at %s', async (_, source, offset) => {
    const document = createDocument(source)

    await expect(
      doHover(document, document.positionAt(offset), createUno()),
    ).resolves.toBeUndefined()
  })

  it('does not return hover at the end-exclusive utility boundary', async () => {
    const source = '<div class="text-red-5"></div>'
    const utility = 'text-red-5'
    const document = createDocument(source)
    const utilityEnd = source.indexOf(utility) + utility.length

    await expect(
      doHover(document, document.positionAt(utilityEnd), createUno()),
    ).resolves.toBeUndefined()
  })

  it('returns hover for an attributify value', async () => {
    const source = '<div text="red-5"></div>'
    const document = createDocument(source)

    const hover = await doHover(
      document,
      positionInside(document, source, 'red-5'),
      createUno({ attributify: true }),
    )

    expect(hover?.range).toEqual(rangeFor(document, source, 'red-5'))
    expect(hover?.contents).toMatchObject({
      kind: 'markdown',
      value: expect.stringContaining('[text="red-5"]'),
    })
    expect(hover?.contents).toMatchObject({
      value: expect.stringContaining('color: rgb(239 68 68 / var(--un-text-opacity));'),
    })
  })

  it('includes class and valueless attributify selectors when attributify is enabled', async () => {
    const source = '<div class="text-red-5"></div>'
    const document = createDocument(source)

    const hover = await doHover(
      document,
      positionInside(document, source, 'text-red-5'),
      createUno({ attributify: true }),
    )

    expect(hover?.contents).toMatchObject({
      kind: 'markdown',
      value: expect.stringContaining('.text-red-5'),
    })
    expect(hover?.contents).toMatchObject({
      value: expect.stringContaining('[text-red-5=""]'),
    })
  })
})
