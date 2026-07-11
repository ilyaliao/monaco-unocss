import type { UnoGenerator } from '@unocss/core'
import { createAutocomplete } from '@unocss/autocomplete'
import { createGenerator } from '@unocss/core'
import { presetAttributify, presetWind3 } from 'unocss'
import { describe, expect, it } from 'vitest'
import { Range } from 'vscode-languageserver-protocol'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { doComplete, resolveCompletionItem } from '../src/worker/complete'
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

function positionAfter(document: TextDocument, source: string, needle: string) {
  const index = source.indexOf(needle)
  if (index < 0)
    throw new Error(`Missing test needle: ${needle}`)

  return document.positionAt(index + needle.length)
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

function getTextEditRange(item: NonNullable<Awaited<ReturnType<typeof doComplete>>>['items'][number]) {
  const edit = item.textEdit

  if (!edit || !('range' in edit))
    throw new Error(`Completion item has no TextEdit range: ${item.label}`)

  return edit.range
}

function getTextEditNewText(item: NonNullable<Awaited<ReturnType<typeof doComplete>>>['items'][number]) {
  const edit = item.textEdit

  if (!edit || !('newText' in edit))
    throw new Error(`Completion item has no TextEdit text: ${item.label}`)

  return edit.newText
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

describe('doComplete', () => {
  it('replaces exactly the typed prefix and leaves list items undocumented', async () => {
    const source = '<div class="bg-red-"></div>'
    const document = createDocument(source)
    const uno = createUno()
    const list = await doComplete(
      document,
      positionAfter(document, source, 'bg-red-'),
      createAutocomplete(uno),
    )

    const item = list?.items.find(item => item.label === 'bg-red-5')

    expect(item).toBeDefined()
    expect(document.getText(getTextEditRange(item!))).toBe('bg-red-')
    expect(getTextEditNewText(item!)).toBe('bg-red-5')
    expect(item).not.toHaveProperty('documentation')
    expect(item).not.toHaveProperty('detail')
  })

  it('completes an attributify attribute value', async () => {
    const source = '<div text="red-"></div>'
    const document = createDocument(source)
    const uno = createUno({ attributify: true })
    const list = await doComplete(
      document,
      positionAfter(document, source, 'red-'),
      createAutocomplete(uno),
    )

    const item = list?.items.find(item => item.label === 'red-5')

    expect(item).toBeDefined()
    expect(document.getText(getTextEditRange(item!))).toBe('red-')
    expect(getTextEditNewText(item!)).toBe('red-5')
  })

  it('completes a valueless attributify attribute', async () => {
    const source = '<div text-r'
    const document = createDocument(source)
    const uno = createUno({ attributify: true })
    const list = await doComplete(
      document,
      positionAfter(document, source, 'text-r'),
      createAutocomplete(uno),
    )

    expect(list?.items.length).toBeGreaterThan(0)

    const item = list?.items.find(item => item.label === 'text-red')

    expect(item).toBeDefined()
    expect(document.getText(getTextEditRange(item!))).toBe('text-r')
    expect(getTextEditNewText(item!)).toBe('text-red')
  })
})

describe('resolveCompletionItem', () => {
  it('adds Prettied CSS markdown documentation to a completion item', async () => {
    const source = '<div class="bg-red-"></div>'
    const document = createDocument(source)
    const uno = createUno()
    const list = await doComplete(
      document,
      positionAfter(document, source, 'bg-red-'),
      createAutocomplete(uno),
    )
    const item = list?.items.find(item => item.label === 'bg-red-5')

    expect(item).toBeDefined()

    const resolved = await resolveCompletionItem(item!, uno)

    expect(resolved.documentation).toMatchObject({
      kind: 'markdown',
      value: expect.stringContaining('background-color: rgb(239 68 68 / var(--un-bg-opacity));'),
    })
    expect(resolved.documentation).toMatchObject({
      value: expect.stringContaining('```css\n'),
    })
  })

  it('returns an unknown utility item unchanged without documentation', async () => {
    const item = { label: 'not-a-utility' }

    await expect(resolveCompletionItem(item, createUno())).resolves.toBe(item)
    expect(item).not.toHaveProperty('documentation')
  })

  it('uses the full utility when resolving an attributify attribute-value completion', async () => {
    const source = '<div text="red-"></div>'
    const document = createDocument(source)
    const uno = createUno({ attributify: true })
    const list = await doComplete(
      document,
      positionAfter(document, source, 'red-'),
      createAutocomplete(uno),
    )
    const item = list?.items.find(item => item.label === 'red-5')

    expect(item).toBeDefined()

    const resolved = await resolveCompletionItem(item!, uno)

    expect(resolved.documentation).toMatchObject({
      kind: 'markdown',
      value: expect.stringContaining('[text-red-5=""]'),
    })
  })
})
