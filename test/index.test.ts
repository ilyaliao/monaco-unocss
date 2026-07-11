import type { UnoGenerator } from '@unocss/core'
import type { Color } from 'vscode-languageserver-protocol'
import { createAutocomplete } from '@unocss/autocomplete'
import { createGenerator } from '@unocss/core'
import { presetAttributify, presetWind3, presetWind4 } from 'unocss'
import { beforeEach, describe, expect, it } from 'vitest'
import { Range } from 'vscode-languageserver-protocol'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getDocumentColors } from '../src/worker/colors'
import { doComplete, resolveCompletionItem } from '../src/worker/complete'
import { doHover } from '../src/worker/hover'
import { clearAllMatchedPositionsCache, getMatchedPositionsForDocument } from '../src/worker/matched-positions-cache'

let fixtureIndex = 0

beforeEach(() => {
  clearAllMatchedPositionsCache()
})

function createDocument(source: string, options: { uri?: string, version?: number } = {}): TextDocument {
  return TextDocument.create(
    options.uri ?? `file:///fixture-${fixtureIndex++}.html`,
    'html',
    options.version ?? 0,
    source,
  )
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

function createUno({ attributify = false, wind = 'wind3' }: { attributify?: boolean, wind?: 'wind3' | 'wind4' } = {}): Promise<UnoGenerator> {
  return createGenerator({
    presets: [
      wind === 'wind4' ? presetWind4() : presetWind3(),
      ...(attributify ? [presetAttributify()] : []),
    ],
  })
}

function expectColor(color: Color, expected: { alpha: number, blue: number, green: number, red: number }) {
  expect(color.red).toBeCloseTo(expected.red / 255, 5)
  expect(color.green).toBeCloseTo(expected.green / 255, 5)
  expect(color.blue).toBeCloseTo(expected.blue / 255, 5)
  expect(color.alpha).toBeCloseTo(expected.alpha, 5)
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

describe('getDocumentColors', () => {
  it('reports a theme color utility at its matched range', async () => {
    const source = '<div class="text-red-5"></div>'
    const document = createDocument(source)

    const colors = await getDocumentColors(document, createUno())

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'text-red-5'))
    expectColor(colors![0].color, { red: 239, green: 68, blue: 68, alpha: 1 })
  })

  it('reports an arbitrary-value color utility', async () => {
    const source = '<div class="bg-[#ff8888]"></div>'
    const document = createDocument(source)

    const colors = await getDocumentColors(document, createUno())

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'bg-[#ff8888]'))
    expectColor(colors![0].color, { red: 255, green: 136, blue: 136, alpha: 1 })
  })

  it('reports an arbitrary named-color utility', async () => {
    const source = '<div class="bg-[hotpink]"></div>'
    const document = createDocument(source)

    const colors = await getDocumentColors(document, createUno())

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'bg-[hotpink]'))
    expectColor(colors![0].color, { red: 255, green: 105, blue: 180, alpha: 1 })
  })

  it('reports a wind4 arbitrary named-color utility instead of transparent preflight colors', async () => {
    const source = '<div class="text-[hotpink]"></div>'
    const document = createDocument(source)

    const colors = await getDocumentColors(document, createUno({ wind: 'wind4' }))

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'text-[hotpink]'))
    // Empirically, presetWind4 emits the default text opacity as 100%.
    expectColor(colors![0].color, { red: 255, green: 105, blue: 180, alpha: 1 })
  })

  it('skips transparent named-color utilities', async () => {
    const source = '<div class="bg-transparent"></div>'
    const document = createDocument(source)

    await expect(getDocumentColors(document, createUno())).resolves.toEqual([])
  })

  it('reports opacity from the generated CSS color', async () => {
    const source = '<div class="text-red-5/50"></div>'
    const document = createDocument(source)

    const colors = await getDocumentColors(document, createUno())

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'text-red-5/50'))
    expectColor(colors![0].color, { red: 239, green: 68, blue: 68, alpha: 0.5 })
  })

  it('reports wind4 color-mix opacity from an oklch theme color', async () => {
    const source = '<div class="text-red-500/50"></div>'
    const document = createDocument(source)

    const colors = await getDocumentColors(document, createUno({ wind: 'wind4' }))

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'text-red-500/50'))
    expectColor(colors![0].color, { red: 251, green: 44, blue: 54, alpha: 0.5 })
  })

  it('reports a variant color utility', async () => {
    const source = '<div class="dark:text-red-5"></div>'
    const document = createDocument(source)

    const colors = await getDocumentColors(document, createUno())

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'dark:text-red-5'))
    expectColor(colors![0].color, { red: 239, green: 68, blue: 68, alpha: 1 })
  })

  it('skips non-color utilities', async () => {
    const source = '<div class="mt-4 flex"></div>'
    const document = createDocument(source)

    await expect(getDocumentColors(document, createUno())).resolves.toEqual([])
  })

  it('reports an attributify color at the attribute-form matched position', async () => {
    const source = '<div text="red-5"></div>'
    const document = createDocument(source)

    const colors = await getDocumentColors(document, createUno({ attributify: true }))

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'red-5'))
    expectColor(colors![0].color, { red: 239, green: 68, blue: 68, alpha: 1 })
  })
})

describe('matched positions cache', () => {
  it('reuses positions for the same uri and document version', async () => {
    const source = '<div class="text-red-5"></div>'
    const uri = 'file:///cache-fixture.html'
    const document = createDocument(source, { uri, version: 1 })
    const uno = await createUno()

    const first = await getMatchedPositionsForDocument(uno, document)
    const second = await getMatchedPositionsForDocument(uno, document)
    const nextVersion = await getMatchedPositionsForDocument(
      uno,
      createDocument(source, { uri, version: 2 }),
    )

    expect(second).toBe(first)
    expect(nextVersion).not.toBe(first)
    expect(nextVersion).toEqual(first)
  })

  it('does not reuse positions when a model is recreated at the same uri and version', async () => {
    const uri = 'file:///cache-recreated-fixture.html'
    const uno = await createUno()

    const first = await getMatchedPositionsForDocument(
      uno,
      createDocument('<div class="text-red-5"></div>', { uri, version: 1 }),
    )
    const recreated = await getMatchedPositionsForDocument(
      uno,
      createDocument('<div class="bg-blue-5"></div>', { uri, version: 1 }),
    )

    expect(recreated).not.toBe(first)
    expect(recreated.map(([, , className]) => className)).toEqual(['bg-blue-5'])
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
