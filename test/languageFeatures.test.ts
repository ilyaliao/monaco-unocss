import type { editor, languages, MonacoEditor } from 'monaco-types'
import type { ColorInformation } from 'vscode-languageserver-protocol'
import type { UnocssWorker } from '../src/types/worker'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDisposable, setupDomGlobals } from './helpers'

async function loadCreateColorProvider() {
  setupDomGlobals()
  vi.resetModules()

  const { createColorProvider } = await import('../src/languageFeatures')
  return createColorProvider
}

function createColorProviderHarness(options: {
  text: string
  lsColors?: ColorInformation[]
}) {
  const monaco = {
    editor: {
      onWillDisposeModel: vi.fn(createDisposable),
    },
  } as unknown as MonacoEditor
  const worker = {
    getDocumentColors: vi.fn(async () => options.lsColors ?? []),
  } as unknown as UnocssWorker
  const deltaDecorations = vi.fn(() => [] as string[])
  const model = {
    uri: 'file:///example.html',
    getLanguageId: () => 'html',
    getValueInRange: () => options.text,
    deltaDecorations,
  } as unknown as editor.ITextModel

  return { monaco, getWorker: async () => worker, model, deltaDecorations }
}

const lsColor: ColorInformation = {
  range: {
    start: { line: 0, character: 12 },
    end: { line: 0, character: 24 },
  },
  color: { red: 1, green: 105 / 255, blue: 180 / 255, alpha: 1 },
}

describe('createColorProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('treats named arbitrary colors as editable', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const { monaco, getWorker, model, deltaDecorations }
      = createColorProviderHarness({ text: 'bg-[hotpink]', lsColors: [lsColor] })

    const provider = createColorProvider(monaco, getWorker)
    const colors = await provider.provideDocumentColors(
      model,
      {} as unknown as import('monaco-types').CancellationToken,
    )

    expect(colors).toHaveLength(1)
    expect(deltaDecorations).toHaveBeenCalledWith([], [])
  })

  it('treats mixed-case named arbitrary colors as editable', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const { monaco, getWorker, model, deltaDecorations }
      = createColorProviderHarness({ text: 'bg-[HotPink]', lsColors: [lsColor] })

    const provider = createColorProvider(monaco, getWorker)
    const colors = await provider.provideDocumentColors(
      model,
      {} as unknown as import('monaco-types').CancellationToken,
    )

    expect(colors).toHaveLength(1)
    expect(deltaDecorations).toHaveBeenCalledWith([], [])
  })

  it('keeps theme colors as non-editable decorations', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const { monaco, getWorker, model, deltaDecorations }
      = createColorProviderHarness({ text: 'text-gray-600', lsColors: [lsColor] })

    const provider = createColorProvider(monaco, getWorker)
    const colors = await provider.provideDocumentColors(
      model,
      {} as unknown as import('monaco-types').CancellationToken,
    )

    expect(colors).toHaveLength(0)
    expect(deltaDecorations).toHaveBeenCalledWith(
      [],
      [expect.objectContaining({ range: expect.anything() })],
    )
  })

  it('provides presentations for named arbitrary colors', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const { monaco, getWorker, model } = createColorProviderHarness({ text: 'bg-[hotpink]' })

    const provider = createColorProvider(monaco, getWorker)
    const presentations = provider.provideColorPresentations(
      model,
      { range: lsColor.range, color: lsColor.color } as unknown as languages.IColorInformation,
      {} as unknown as import('monaco-types').CancellationToken,
    ) as languages.IColorPresentation[]

    expect(presentations).toHaveLength(3)
    expect(presentations[0].label).toBe('bg-[#ff69b4]')
    expect(presentations[1].label).toBe('bg-[rgb(255,105,180)]')
  })

  it('provides presentations for mixed-case named colors', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const { monaco, getWorker, model } = createColorProviderHarness({ text: 'bg-[HotPink]' })

    const provider = createColorProvider(monaco, getWorker)
    const presentations = provider.provideColorPresentations(
      model,
      { range: lsColor.range, color: lsColor.color } as unknown as languages.IColorInformation,
      {} as unknown as import('monaco-types').CancellationToken,
    ) as languages.IColorPresentation[]

    expect(presentations[0].label).toBe('bg-[#ff69b4]')
  })

  it('preserves short hex notation in presentations', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const { monaco, getWorker, model } = createColorProviderHarness({ text: 'bg-[#f88]' })

    const provider = createColorProvider(monaco, getWorker)
    const presentations = provider.provideColorPresentations(
      model,
      {
        range: lsColor.range,
        color: { red: 1, green: 0x88 / 255, blue: 0x88 / 255, alpha: 1 },
      } as unknown as languages.IColorInformation,
      {} as unknown as import('monaco-types').CancellationToken,
    ) as languages.IColorPresentation[]

    expect(presentations[0].label).toBe('bg-[#f88]')
  })
})
