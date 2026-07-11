import type { UserConfig } from '@unocss/core'
// @env node
import type { Color, Diagnostic, Hover, Position, TextEdit } from 'vscode-languageserver-protocol'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { DocumentSession } from '../src/worker/document-session'
import transformerVariantGroup from '@unocss/transformer-variant-group'
import { presetAttributify, presetWind3, presetWind4 } from 'unocss'
import { describe, expect, it } from 'vitest'
import { DiagnosticSeverity, Range } from 'vscode-languageserver-protocol'
import { getDocumentColors } from '../src/worker/colors'
import { doComplete, resolveCompletionItem } from '../src/worker/complete'
import { createDocumentSessionFactory } from '../src/worker/document-session'
import { generateStylesFromContent } from '../src/worker/generate-styles'
import { doHover } from '../src/worker/hover'

let fixtureIndex = 0

function positionInside(document: TextDocument, source: string, needle: string): Position {
  const index = source.indexOf(needle)
  if (index < 0)
    throw new Error(`Missing test needle: ${needle}`)

  return document.positionAt(index + Math.floor(needle.length / 2))
}

function positionAfter(document: TextDocument, source: string, needle: string): Position {
  const index = source.indexOf(needle)
  if (index < 0)
    throw new Error(`Missing test needle: ${needle}`)

  return document.positionAt(index + needle.length)
}

function rangeFor(document: TextDocument, source: string, needle: string): Range {
  const index = source.indexOf(needle)
  if (index < 0)
    throw new Error(`Missing test needle: ${needle}`)

  return Range.create(
    document.positionAt(index),
    document.positionAt(index + needle.length),
  )
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1
}

type TestUnoConfig = Pick<
  UserConfig,
  | 'blocklist'
  | 'extractorDefault'
  | 'extractors'
  | 'preflights'
  | 'preprocess'
  | 'rules'
  | 'safelist'
  | 'shortcuts'
  | 'transformers'
> & {
  attributify?: boolean
  wind?: 'wind3' | 'wind4'
}

interface TestMirrorModel {
  getValue: () => string
  source: string
  uri: string
  version: number
}

interface TestSessionOptions {
  unocssConfig?: UserConfig | PromiseLike<UserConfig>
  uri?: string
  version?: number
}

type CompletionItemUnderTest = NonNullable<Awaited<ReturnType<typeof doComplete>>>['items'][number]

function createUnoConfig({
  attributify = false,
  blocklist,
  extractorDefault,
  extractors,
  preflights,
  preprocess,
  rules,
  safelist,
  shortcuts,
  transformers,
  wind = 'wind3',
}: TestUnoConfig = {}): UserConfig {
  return {
    blocklist,
    extractorDefault,
    extractors,
    preflights,
    preprocess,
    rules,
    safelist,
    shortcuts,
    transformers,
    presets: [
      wind === 'wind4' ? presetWind4() : presetWind3(),
      ...(attributify ? [presetAttributify()] : []),
    ],
  }
}

function createFailingUnoConfig(cause = new Error('broken preset')): UserConfig {
  return {
    presets: [async () => {
      throw cause
    }],
  }
}

function createObservableCacheConfig(
  source: string,
  getAnnotatedUtility: () => string,
): TestUnoConfig {
  const markerOffset = source.indexOf('marker')
  if (markerOffset < 0)
    throw new Error('Missing observable-cache marker')

  return {
    transformers: [{
      name: 'observable-cache',
      transform() {
        return {
          highlightAnnotations: [{
            className: getAnnotatedUtility(),
            length: 'marker'.length,
            offset: markerOffset,
          }],
        }
      },
    }],
  }
}

function createTestSession(
  source: string,
  config: TestUnoConfig = {},
  options: TestSessionOptions = {},
) {
  const uri = options.uri ?? `file:///fixture-${fixtureIndex++}.html`
  const model: TestMirrorModel = {
    getValue: () => model.source,
    source,
    uri,
    version: options.version ?? 0,
  }
  const models = [model]
  const factory = createDocumentSessionFactory(
    () => models,
    options.unocssConfig ?? createUnoConfig(config),
  )
  const session = factory.resolveDocument(uri, 'html')

  if (!session)
    throw new Error(`Missing test session: ${uri}`)

  return {
    document: session.document,
    factory,
    models,
    session,
  }
}

function expectColor(color: Color, expected: { alpha: number, blue: number, green: number, red: number }): void {
  expect(color.red).toBeCloseTo(expected.red / 255, 5)
  expect(color.green).toBeCloseTo(expected.green / 255, 5)
  expect(color.blue).toBeCloseTo(expected.blue / 255, 5)
  expect(color.alpha).toBeCloseTo(expected.alpha, 5)
}

function expectHoverCss(hover: Hover | undefined, css: string): void {
  expect(hover?.contents).toMatchObject({
    value: expect.stringContaining(css),
  })
}

function getTextEditRange(item: CompletionItemUnderTest): Range {
  const edit = item.textEdit

  if (!edit || !('range' in edit))
    throw new Error(`Completion item has no TextEdit range: ${item.label}`)

  return edit.range
}

function getTextEditNewText(item: CompletionItemUnderTest): string {
  const edit = item.textEdit

  if (!edit || !('newText' in edit))
    throw new Error(`Completion item has no TextEdit text: ${item.label}`)

  return edit.newText
}

describe('document session factory', () => {
  it('resolves a mirror model into a document session', () => {
    const source = '<div class="text-red-5"></div>'
    const uri = 'file:///session-fixture.html'
    const factory = createDocumentSessionFactory(
      () => [{
        getValue: () => source,
        uri,
        version: 3,
      }],
      { presets: [presetWind3()] },
    )

    const session = factory.resolveDocument(uri, 'html')

    expect(session?.document).toMatchObject({
      languageId: 'html',
      uri,
      version: 3,
    })
    expect(session?.document.getText()).toBe(source)
    expect(factory.resolveDocument('file:///missing.html', 'html')).toBeUndefined()
  })
})

describe('doHover', () => {
  it('returns prettied CSS and the matched range for a utility', async () => {
    const source = '<div class="text-red-5"></div>'
    const { document, session } = createTestSession(source)

    const hover = await doHover(
      session,
      positionInside(document, source, 'text-red-5'),
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
    const { document, session } = createTestSession(source)

    await expect(
      doHover(session, positionInside(document, source, needle)),
    ).resolves.toBeUndefined()
  })

  it.each([
    ['offset 0', '<div class="text-red-5"></div>', 0],
    ['inside an opening tag before any utility', '<div class="text-red-5"></div>', 2],
  ])('returns undefined instead of throwing at %s', async (_, source, offset) => {
    const { document, session } = createTestSession(source)

    await expect(
      doHover(session, document.positionAt(offset)),
    ).resolves.toBeUndefined()
  })

  it('does not return hover at the end-exclusive utility boundary', async () => {
    const source = '<div class="text-red-5"></div>'
    const utility = 'text-red-5'
    const { document, session } = createTestSession(source)
    const utilityEnd = source.indexOf(utility) + utility.length

    await expect(
      doHover(session, document.positionAt(utilityEnd)),
    ).resolves.toBeUndefined()
  })

  it('returns hover for an attributify value', async () => {
    const source = '<div text="red-5"></div>'
    const { document, session } = createTestSession(source, { attributify: true })

    const hover = await doHover(
      session,
      positionInside(document, source, 'red-5'),
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
    const { document, session } = createTestSession(source, { attributify: true })

    const hover = await doHover(
      session,
      positionInside(document, source, 'text-red-5'),
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
    const { document, session } = createTestSession(source)

    const colors = await getDocumentColors(session)

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'text-red-5'))
    expectColor(colors![0].color, { red: 239, green: 68, blue: 68, alpha: 1 })
  })

  it('reports an arbitrary-value color utility', async () => {
    const source = '<div class="bg-[#ff8888]"></div>'
    const { document, session } = createTestSession(source)

    const colors = await getDocumentColors(session)

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'bg-[#ff8888]'))
    expectColor(colors![0].color, { red: 255, green: 136, blue: 136, alpha: 1 })
  })

  it('reports an arbitrary named-color utility', async () => {
    const source = '<div class="bg-[hotpink]"></div>'
    const { document, session } = createTestSession(source)

    const colors = await getDocumentColors(session)

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'bg-[hotpink]'))
    expectColor(colors![0].color, { red: 255, green: 105, blue: 180, alpha: 1 })
  })

  it('reports a wind4 arbitrary named-color utility instead of transparent preflight colors', async () => {
    const source = '<div class="text-[hotpink]"></div>'
    const { document, session } = createTestSession(source, { wind: 'wind4' })

    const colors = await getDocumentColors(session)

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'text-[hotpink]'))
    // Empirically, presetWind4 emits the default text opacity as 100%.
    expectColor(colors![0].color, { red: 255, green: 105, blue: 180, alpha: 1 })
  })

  it('skips transparent named-color utilities', async () => {
    const source = '<div class="bg-transparent"></div>'
    const { session } = createTestSession(source)

    await expect(getDocumentColors(session)).resolves.toEqual([])
  })

  it('reports opacity from the generated CSS color', async () => {
    const source = '<div class="text-red-5/50"></div>'
    const { document, session } = createTestSession(source)

    const colors = await getDocumentColors(session)

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'text-red-5/50'))
    expectColor(colors![0].color, { red: 239, green: 68, blue: 68, alpha: 0.5 })
  })

  it('reports wind4 color-mix opacity from an oklch theme color', async () => {
    const source = '<div class="text-red-500/50"></div>'
    const { document, session } = createTestSession(source, { wind: 'wind4' })

    const colors = await getDocumentColors(session)

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'text-red-500/50'))
    expectColor(colors![0].color, { red: 251, green: 44, blue: 54, alpha: 0.5 })
  })

  it('reports a variant color utility', async () => {
    const source = '<div class="dark:text-red-5"></div>'
    const { document, session } = createTestSession(source)

    const colors = await getDocumentColors(session)

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'dark:text-red-5'))
    expectColor(colors![0].color, { red: 239, green: 68, blue: 68, alpha: 1 })
  })

  it('skips non-color utilities', async () => {
    const source = '<div class="mt-4 flex"></div>'
    const { session } = createTestSession(source)

    await expect(getDocumentColors(session)).resolves.toEqual([])
  })

  it('reports an attributify color at the attribute-form matched position', async () => {
    const source = '<div text="red-5"></div>'
    const { document, session } = createTestSession(source, { attributify: true })

    const colors = await getDocumentColors(session)

    expect(colors).toHaveLength(1)
    expect(colors?.[0].range).toEqual(rangeFor(document, source, 'red-5'))
    expectColor(colors![0].color, { red: 239, green: 68, blue: 68, alpha: 1 })
  })
})

describe('document session cache', () => {
  it('reuses matched positions until the document version changes', async () => {
    const source = '<div class="marker"></div>'
    let annotatedUtility = 'text-red-5'
    const { factory, models, session } = createTestSession(
      source,
      createObservableCacheConfig(source, () => annotatedUtility),
      { uri: 'file:///cache-fixture.html', version: 1 },
    )

    const first = await doHover(
      session,
      positionInside(session.document, source, 'marker'),
    )
    annotatedUtility = 'bg-blue-5'
    const cachedSession = factory.resolveDocument(models[0].uri, 'html')!
    const cached = await doHover(
      cachedSession,
      positionInside(cachedSession.document, source, 'marker'),
    )
    models[0].version++
    const updatedSession = factory.resolveDocument(models[0].uri, 'html')!
    const updated = await doHover(
      updatedSession,
      positionInside(updatedSession.document, source, 'marker'),
    )

    expectHoverCss(first, 'color: rgb(239 68 68 / var(--un-text-opacity));')
    expectHoverCss(cached, 'color: rgb(239 68 68 / var(--un-text-opacity));')
    expectHoverCss(updated, 'background-color: rgb(59 130 246 / var(--un-bg-opacity));')
  })

  it('recomputes matched positions when a model is recreated at the same uri and version', async () => {
    const source = '<div class="text-red-5"></div>'
    const { factory, models, session } = createTestSession(
      source,
      {},
      { uri: 'file:///cache-recreated-fixture.html', version: 1 },
    )

    const first = await doHover(
      session,
      positionInside(session.document, source, 'text-red-5'),
    )
    const recreatedSource = '<div class="bg-blue-5"></div>'
    models[0].source = recreatedSource
    const recreatedSession = factory.resolveDocument(models[0].uri, 'html')!
    const recreated = await doHover(
      recreatedSession,
      positionInside(recreatedSession.document, recreatedSource, 'bg-blue-5'),
    )

    expectHoverCss(first, 'color: rgb(239 68 68 / var(--un-text-opacity));')
    expectHoverCss(recreated, 'background-color: rgb(59 130 246 / var(--un-bg-opacity));')
  })

  it('evicts matched positions when the mirror model is removed', async () => {
    const source = '<div class="marker"></div>'
    let annotatedUtility = 'text-red-5'
    const { factory, models, session } = createTestSession(
      source,
      createObservableCacheConfig(source, () => annotatedUtility),
      { uri: 'file:///cache-eviction-fixture.html', version: 1 },
    )
    const model = models[0]

    const first = await doHover(
      session,
      positionInside(session.document, source, 'marker'),
    )
    annotatedUtility = 'bg-blue-5'
    models.splice(0)
    expect(factory.resolveDocument(model.uri, 'html')).toBeUndefined()
    models.push(model)
    const restoredSession = factory.resolveDocument(model.uri, 'html')!
    const restored = await doHover(
      restoredSession,
      positionInside(restoredSession.document, source, 'marker'),
    )

    expectHoverCss(first, 'color: rgb(239 68 68 / var(--un-text-opacity));')
    expectHoverCss(restored, 'background-color: rgb(59 130 246 / var(--un-bg-opacity));')
  })

  it('recomputes matched positions after an in-flight session model is removed and restored', async () => {
    const source = '<div class="marker"></div>'
    let annotatedUtility = 'text-red-5'
    let resolveConfig!: (config: UserConfig) => void
    const delayedConfig = new Promise<UserConfig>((resolve) => {
      resolveConfig = resolve
    })
    const { factory, models, session } = createTestSession(
      source,
      {},
      {
        unocssConfig: delayedConfig,
        uri: 'file:///cache-in-flight-eviction-fixture.html',
        version: 1,
      },
    )
    const model = models[0]
    const inFlight = doHover(
      session,
      positionInside(session.document, source, 'marker'),
    )

    models.splice(0)
    expect(factory.resolveDocument(model.uri, 'html')).toBeUndefined()
    models.push(model)
    const restoredSession = factory.resolveDocument(model.uri, 'html')!

    resolveConfig(createUnoConfig(
      createObservableCacheConfig(source, () => annotatedUtility),
    ))
    expectHoverCss(await inFlight, 'color: rgb(239 68 68 / var(--un-text-opacity));')
    annotatedUtility = 'bg-blue-5'

    const restored = await doHover(
      restoredSession,
      positionInside(restoredSession.document, source, 'marker'),
    )

    expectHoverCss(restored, 'background-color: rgb(59 130 246 / var(--un-bg-opacity));')
  })

  it('recomputes matched positions after an in-flight session model is recreated at the same uri', async () => {
    const source = '<div class="marker"></div>'
    let annotatedUtility = 'text-red-5'
    let resolveConfig!: (config: UserConfig) => void
    const delayedConfig = new Promise<UserConfig>((resolve) => {
      resolveConfig = resolve
    })
    const { factory, models, session } = createTestSession(
      source,
      {},
      {
        unocssConfig: delayedConfig,
        uri: 'file:///cache-in-flight-recreation-fixture.html',
        version: 1,
      },
    )
    const model = models[0]
    const inFlight = doHover(
      session,
      positionInside(session.document, source, 'marker'),
    )

    const recreatedModel: TestMirrorModel = {
      getValue: () => recreatedModel.source,
      source,
      uri: model.uri,
      version: model.version,
    }
    models.splice(0, 1, recreatedModel)
    const recreatedSession = factory.resolveDocument(model.uri, 'html')!

    resolveConfig(createUnoConfig(
      createObservableCacheConfig(source, () => annotatedUtility),
    ))
    expectHoverCss(await inFlight, 'color: rgb(239 68 68 / var(--un-text-opacity));')
    annotatedUtility = 'bg-blue-5'

    const recreated = await doHover(
      recreatedSession,
      positionInside(recreatedSession.document, source, 'marker'),
    )

    expectHoverCss(recreated, 'background-color: rgb(59 130 246 / var(--un-bg-opacity));')
  })
})

describe('document session failures', () => {
  it('returns undefined from generator-dependent document features when initialization fails', async () => {
    const source = '<div class="mt-2 mt-4 bg-red-"></div>'
    const { document, session } = createTestSession(source, {}, {
      unocssConfig: createFailingUnoConfig(),
    })

    await expect(Promise.all([
      doHover(session, positionInside(document, source, 'mt-2')),
      getDocumentColors(session),
      doValidate(session),
      doComplete(session, positionAfter(document, source, 'bg-red-')),
    ])).resolves.toEqual([undefined, undefined, undefined, undefined])
  })

  it('returns undefined when autocomplete initialization fails', async () => {
    const source = '<div class="broken-"></div>'
    const { document, session } = createTestSession(source, {
      rules: [[
        /^broken$/,
        () => ({ display: 'block' }),
        { autocomplete: 'broken-<missing>' },
      ]],
    })
    const position = positionAfter(document, source, 'broken-')

    await expect(Promise.all([
      doComplete(session, position),
      doComplete(session, position),
    ])).resolves.toEqual([undefined, undefined])
  })

  it('returns undefined when matched-position computation fails', async () => {
    const source = '<div class="text-red-5"></div>'
    const { document, session } = createTestSession(source, {
      transformers: [{
        name: 'broken-matched-positions',
        transform() {
          throw new Error('broken matched positions')
        },
      }],
    })

    await expect(Promise.all([
      doHover(session, positionInside(document, source, 'text-red-5')),
      getDocumentColors(session),
      doValidate(session),
    ])).resolves.toEqual([undefined, undefined, undefined])
  })

  it('retries matched-position computation from a later session after failure', async () => {
    const source = '<div class="marker"></div>'
    const markerOffset = source.indexOf('marker')
    let shouldFail = true
    const { factory, models, session } = createTestSession(source, {
      transformers: [{
        name: 'retry-matched-positions',
        transform() {
          if (shouldFail) {
            shouldFail = false
            throw new Error('transient matched-position failure')
          }

          return {
            highlightAnnotations: [{
              className: 'text-red-5',
              length: 'marker'.length,
              offset: markerOffset,
            }],
          }
        },
      }],
    })

    const first = await doHover(
      session,
      positionInside(session.document, source, 'marker'),
    )
    const retrySession = factory.resolveDocument(models[0].uri, 'html')!
    const retried = await doHover(
      retrySession,
      positionInside(retrySession.document, source, 'marker'),
    )

    expect(first).toBeUndefined()
    expectHoverCss(retried, 'color: rgb(239 68 68 / var(--un-text-opacity));')
  })

  it('does not compute matched positions for completion', async () => {
    const source = '<div class="bg-red-"></div>'
    const { document, session } = createTestSession(source, {
      transformers: [{
        name: 'broken-unused-matched-positions',
        transform() {
          throw new Error('matched positions should stay lazy')
        },
      }],
    })

    const list = await doComplete(
      session,
      positionAfter(document, source, 'bg-red-'),
    )

    expect(list?.items.some(item => item.label === 'bg-red-5')).toBe(true)
  })

  it('propagates feature errors after session dependencies resolve', async () => {
    const source = '<div class="marker"></div>'
    const markerOffset = source.indexOf('marker')
    const { session } = createTestSession(source, {
      rules: [[/^explode$/, () => {
        throw new Error('feature exploded')
      }]],
      transformers: [{
        name: 'feature-error-annotation',
        transform() {
          return {
            highlightAnnotations: [{
              className: 'explode',
              length: 'marker'.length,
              offset: markerOffset,
            }],
          }
        },
      }],
    })

    await expect(doValidate(session)).rejects.toThrow('feature exploded')
  })

  it('keeps document-only code actions available when generator initialization fails', () => {
    const source = '<div class="float-left"></div>'
    const { document, session } = createTestSession(source, {}, {
      unocssConfig: createFailingUnoConfig(),
    })
    const diagnostic: Diagnostic = {
      code: 'blocklist',
      message: 'blocked',
      range: rangeFor(document, source, 'float-left'),
      source: 'unocss',
    }

    const actions = doCodeActions(session, diagnostic.range, {
      diagnostics: [diagnostic],
    })

    expect(actions?.[0].title).toBe('Remove \'float-left\'')
  })
})

describe('doComplete', () => {
  it('replaces exactly the typed prefix and leaves list items undocumented', async () => {
    const source = '<div class="bg-red-"></div>'
    const { document, session } = createTestSession(source)
    const list = await doComplete(
      session,
      positionAfter(document, source, 'bg-red-'),
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
    const { document, session } = createTestSession(source, { attributify: true })
    const list = await doComplete(
      session,
      positionAfter(document, source, 'red-'),
    )

    const item = list?.items.find(item => item.label === 'red-5')

    expect(item).toBeDefined()
    expect(document.getText(getTextEditRange(item!))).toBe('red-')
    expect(getTextEditNewText(item!)).toBe('red-5')
  })

  it('completes a valueless attributify attribute', async () => {
    const source = '<div text-r'
    const { document, session } = createTestSession(source, { attributify: true })
    const list = await doComplete(
      session,
      positionAfter(document, source, 'text-r'),
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
    const { document, factory, session } = createTestSession(source)
    const list = await doComplete(
      session,
      positionAfter(document, source, 'bg-red-'),
    )
    const item = list?.items.find(item => item.label === 'bg-red-5')

    expect(item).toBeDefined()

    const resolved = await resolveCompletionItem(factory, item!)

    expect(resolved.documentation).toMatchObject({
      kind: 'markdown',
      value: expect.stringContaining('background-color: rgb(239 68 68 / var(--un-bg-opacity));'),
    })
    expect(resolved.documentation).toMatchObject({
      value: expect.stringContaining('```css\n'),
    })
  })

  it('returns an unknown utility item unchanged without documentation', async () => {
    const { factory } = createTestSession('')
    const item = { label: 'not-a-utility' }

    await expect(resolveCompletionItem(factory, item)).resolves.toBe(item)
    expect(item).not.toHaveProperty('documentation')
  })

  it('returns a known utility item unchanged when generator initialization fails', async () => {
    const { factory } = createTestSession('', {}, {
      unocssConfig: createFailingUnoConfig(),
    })
    const item = { data: { value: 'mt-2' }, label: 'mt-2' }

    await expect(resolveCompletionItem(factory, item)).resolves.toBe(item)
    expect(item).not.toHaveProperty('documentation')
  })

  it('uses the full utility when resolving an attributify attribute-value completion', async () => {
    const source = '<div text="red-"></div>'
    const { document, factory, session } = createTestSession(source, { attributify: true })
    const list = await doComplete(
      session,
      positionAfter(document, source, 'red-'),
    )
    const item = list?.items.find(item => item.label === 'red-5')

    expect(item).toBeDefined()

    const resolved = await resolveCompletionItem(factory, item!)

    expect(resolved.documentation).toMatchObject({
      kind: 'markdown',
      value: expect.stringContaining('[text-red-5=""]'),
    })
  })
})

describe('generateStylesFromContent', () => {
  it('generates CSS for extracted utilities only', async () => {
    const { factory } = createTestSession('')
    const css = await generateStylesFromContent(
      factory,
      ['<div class="mt-2 text-red-5"></div>'],
      { preflights: false, safelist: false },
    )

    expect(css).toContain('.mt-2')
    expect(css).toContain('margin-top:0.5rem')
    expect(css).toContain('.text-red-5')
    expect(css).toContain('color:rgb(239 68 68 / var(--un-text-opacity))')
    expect(css).not.toContain('.mb-2')
    expect(css).not.toContain('padding')
  })

  it('throws a descriptive error when generator initialization fails', async () => {
    const cause = new Error('broken preset')
    const { factory } = createTestSession('', {}, {
      unocssConfig: createFailingUnoConfig(cause),
    })
    let thrown: unknown

    try {
      await generateStylesFromContent(factory, [])
    }
    catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({
      message: 'Unable to generate styles because the UnoCSS generator failed to initialize: broken preset',
      name: 'UnoGeneratorInitializationError',
    })
    expect((thrown as Error).cause).toBe(cause)
  })

  it('honors shortcuts from the generator config', async () => {
    const { factory } = createTestSession('', {
      shortcuts: [
        ['btn-primary', 'px-4 py-2'],
      ],
    })
    const css = await generateStylesFromContent(
      factory,
      ['<button class="btn-primary"></button>'],
      { preflights: false, safelist: false },
    )

    expect(css).toContain('.btn-primary')
    expect(css).toContain('padding-left:1rem')
    expect(css).toContain('padding-right:1rem')
    expect(css).toContain('padding-top:0.5rem')
    expect(css).toContain('padding-bottom:0.5rem')
  })

  it('applies configured source transformers before extracting utilities', async () => {
    const { factory } = createTestSession('', {
      transformers: [
        transformerVariantGroup(),
      ],
    })
    const css = await generateStylesFromContent(
      factory,
      ['<div class="hover:(mt-2 text-red-5)"></div>'],
      { preflights: false, safelist: false },
    )

    expect(css).toContain('.hover\\:mt-2:hover')
    expect(css).toContain('margin-top:0.5rem')
    expect(css).toContain('.hover\\:text-red-5:hover')
    expect(css).toContain('color:rgb(239 68 68 / var(--un-text-opacity))')
  })

  it('uses the preflights generate option', async () => {
    const { factory } = createTestSession('', {
      preflights: [
        {
          getCSS: () => '*,::before,::after{box-sizing:border-box;}',
        },
      ],
    })

    const withPreflights = await generateStylesFromContent(
      factory,
      ['<div></div>'],
      { preflights: true, safelist: false },
    )
    const withoutPreflights = await generateStylesFromContent(
      factory,
      ['<div></div>'],
      { preflights: false, safelist: false },
    )

    expect(withPreflights).toContain('box-sizing:border-box')
    expect(withoutPreflights).not.toContain('box-sizing:border-box')
  })

  it('uses the minify generate option', async () => {
    const { factory } = createTestSession('')

    const readable = await generateStylesFromContent(
      factory,
      ['<div class="mt-2"></div>'],
      { preflights: false, safelist: false, minify: false },
    )
    const minified = await generateStylesFromContent(
      factory,
      ['<div class="mt-2"></div>'],
      { preflights: false, safelist: false, minify: true },
    )

    expect(readable).toContain('\n')
    expect(minified).not.toContain('\n')
    expect(minified).not.toContain('/* layer')
    expect(minified).toContain('.mt-2{margin-top:0.5rem;}')
  })

  it('uses the safelist generate option', async () => {
    const { factory } = createTestSession('', { safelist: ['mt-4'] })

    const withSafelist = await generateStylesFromContent(
      factory,
      [],
      { preflights: false, safelist: true },
    )
    const withoutSafelist = await generateStylesFromContent(
      factory,
      [],
      { preflights: false, safelist: false },
    )

    expect(withSafelist).toContain('.mt-4')
    expect(withoutSafelist).toBe('')
  })

  it('merges multiple content entries without duplicated rules', async () => {
    const { factory } = createTestSession('')
    const css = await generateStylesFromContent(
      factory,
      [
        { content: '<div class="mt-2"></div>', extension: 'html' },
        { content: '<section class="mt-2 mb-4"></section>', extension: '.html' },
      ],
      { preflights: false, safelist: false },
    )

    expect(countOccurrences(css, '.mt-2')).toBe(1)
    expect(countOccurrences(css, 'margin-top:0.5rem')).toBe(1)
    expect(css).toContain('.mb-4')
  })

  it('passes Content.extension through as a generator id', async () => {
    const { factory } = createTestSession('', {
      extractorDefault: false,
      extractors: [
        {
          name: 'test-vue-only',
          extract({ code, id }) {
            if (!id?.endsWith('.vue') || !code.includes('vue-only'))
              return []

            return ['vue-only']
          },
        },
      ],
      rules: [
        ['vue-only', { color: 'red' }],
      ],
    })

    const withoutVueId = await generateStylesFromContent(
      factory,
      [{ content: 'vue-only', extension: 'html' }],
      { preflights: false, safelist: false },
    )
    const withVueId = await generateStylesFromContent(
      factory,
      [{ content: 'vue-only', extension: 'vue' }],
      { preflights: false, safelist: false },
    )

    expect(withoutVueId).toBe('')
    expect(withVueId).toContain('.vue-only')
    expect(withVueId).toContain('color:red')
  })

  it('returns empty CSS for no-utility content without crashing', async () => {
    const { factory } = createTestSession('')

    await expect(
      generateStylesFromContent(
        factory,
        ['plain text only'],
        { preflights: false, safelist: false },
      ),
    ).resolves.toBe('')
  })

  it('can return preflight-only CSS for no-utility content', async () => {
    const { factory } = createTestSession('', {
      preflights: [
        {
          getCSS: () => ':root{--uno-ready:1;}',
        },
      ],
    })

    await expect(
      generateStylesFromContent(
        factory,
        ['plain text only'],
        { preflights: true, safelist: false },
      ),
    ).resolves.toContain('--uno-ready:1')
  })
})
