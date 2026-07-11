import type { editor, IRange, languages, MonacoEditor } from 'monaco-types'
import type { ColorInformation, Diagnostic } from 'vscode-languageserver-protocol'
import type { UnocssWorker, WorkerFeatureResult } from '../src/types/worker'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeferred, createDisposable, settleSoon, setupDomGlobals } from './helpers'

async function loadCreateColorProvider() {
  setupDomGlobals()
  vi.resetModules()

  const { createColorProvider } = await import('../src/languageFeatures')
  return createColorProvider
}

async function loadCreateMarkerDataProvider() {
  setupDomGlobals()
  vi.resetModules()

  const { createMarkerDataProvider } = await import('../src/languageFeatures')
  return createMarkerDataProvider
}

function createColorProviderHarness(options: {
  decorationIds?: string[]
  getVersionId?: () => number
  lsColors?: ColorInformation[]
  text: string | ((range: IRange) => string)
  workerResults?: Array<
    | Promise<WorkerFeatureResult<ColorInformation> | undefined>
    | WorkerFeatureResult<ColorInformation>
    | undefined
  >
}) {
  const monaco = {
    editor: {
      onDidChangeModelLanguage: vi.fn(createDisposable),
      onWillDisposeModel: vi.fn(createDisposable),
    },
  } as unknown as MonacoEditor
  const workerResults = options.workerResults
    ?? [{ ok: true, value: options.lsColors ?? [] } satisfies WorkerFeatureResult<ColorInformation>]
  let workerResultIndex = 0
  const worker = {
    getDocumentColors: vi.fn(async () => {
      if (workerResultIndex < workerResults.length)
        return workerResults[workerResultIndex++]

      return { ok: true, value: [] } as const
    }),
  } as unknown as UnocssWorker
  const deltaDecorations = vi.fn((
    _oldDecorations: string[],
    _newDecorations: editor.IModelDeltaDecoration[],
  ) => options.decorationIds ?? [])
  const model = {
    uri: 'file:///example.html',
    getLanguageId: () => 'html',
    getVersionId: options.getVersionId ?? (() => 1),
    getValueInRange: (range: IRange) =>
      typeof options.text === 'function' ? options.text(range) : options.text,
    isDisposed: () => false,
    deltaDecorations,
  } as unknown as editor.ITextModel

  return { monaco, getWorker: async () => worker, model, deltaDecorations, worker }
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

  it('keeps alpha in non-editable color decoration classes and rules', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const translucentColor: ColorInformation = {
      ...lsColor,
      range: {
        start: { line: 0, character: 25 },
        end: { line: 0, character: 35 },
      },
      color: { ...lsColor.color, alpha: 0.5 },
    }
    const { monaco, getWorker, model, deltaDecorations }
      = createColorProviderHarness({
        text: 'text-red-5',
        lsColors: [lsColor, translucentColor],
      })

    const provider = createColorProvider(monaco, getWorker)
    await provider.provideDocumentColors(
      model,
      {} as unknown as import('monaco-types').CancellationToken,
    )

    const [, decorations] = deltaDecorations.mock.calls[0] as unknown as [
      string[],
      editor.IModelDeltaDecoration[],
    ]
    const classNames = decorations.map(
      decoration => decoration.options.before?.inlineClassName?.split(' ')[0],
    )
    const rules = Array.from(
      document.adoptedStyleSheets[0].cssRules,
      rule => rule.cssText,
    )

    expect(classNames).toEqual([
      'unocss-color-decoration-ff69b4ff',
      'unocss-color-decoration-ff69b480',
    ])
    expect(rules).toEqual([
      '.unocss-color-decoration-ff69b4ff{background-color:#ff69b4ff}',
      '.unocss-color-decoration-ff69b480{background-color:#ff69b480}',
    ])
  })

  it('preserves editable and non-editable colors on failure, then clears on successful empty', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const themeColor: ColorInformation = {
      ...lsColor,
      range: {
        start: { line: 0, character: 25 },
        end: { line: 0, character: 36 },
      },
    }
    const { monaco, getWorker, model, deltaDecorations }
      = createColorProviderHarness({
        decorationIds: ['theme-color-decoration'],
        text: range => range.startColumn === 13 ? 'bg-[hotpink]' : 'text-red-5',
        workerResults: [
          { ok: true, value: [lsColor, themeColor] },
          { ok: false },
          { ok: true, value: [] },
        ],
      })
    const provider = createColorProvider(monaco, getWorker)
    const token = {} as unknown as import('monaco-types').CancellationToken

    const initial = await provider.provideDocumentColors(model, token)
    const preserved = await provider.provideDocumentColors(model, token)

    expect(initial).toHaveLength(1)
    expect(preserved).toBe(initial)
    expect(deltaDecorations).toHaveBeenCalledTimes(1)

    const cleared = await provider.provideDocumentColors(model, token)

    expect(cleared).toEqual([])
    expect(deltaDecorations).toHaveBeenLastCalledWith(['theme-color-decoration'], [])
  })

  it('clears non-editable color decorations and its model listener on disposal', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const { monaco, getWorker, model, deltaDecorations }
      = createColorProviderHarness({
        decorationIds: ['theme-color-decoration'],
        lsColors: [lsColor],
        text: 'text-red-5',
      })
    const provider = createColorProvider(monaco, getWorker)
    const modelDisposeListener = vi.mocked(monaco.editor.onWillDisposeModel).mock.results[0].value
    const token = {} as unknown as import('monaco-types').CancellationToken

    await provider.provideDocumentColors(model, token)
    provider.dispose()

    expect(deltaDecorations).toHaveBeenLastCalledWith(['theme-color-decoration'], [])
    expect(modelDisposeListener.dispose).toHaveBeenCalledOnce()
  })

  it('does not call the color RPC when disposal wins the worker-accessor race', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const workerResult = createDeferred<UnocssWorker>()
    const getDocumentColors = vi.fn(async () => ({ ok: true as const, value: [lsColor] }))
    const worker = { getDocumentColors } as unknown as UnocssWorker
    const { monaco, model }
      = createColorProviderHarness({ text: 'text-red-5' })
    const provider = createColorProvider(monaco, () => workerResult.promise)
    const request = provider.provideDocumentColors(
      model,
      {} as unknown as import('monaco-types').CancellationToken,
    )

    provider.dispose()
    workerResult.resolve(worker)

    await expect(request).resolves.toBeUndefined()
    expect(getDocumentColors).not.toHaveBeenCalled()
  })

  it('settles an in-flight color request when reset invalidates a stuck RPC', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const stuckResult = createDeferred<WorkerFeatureResult<ColorInformation>>()
    const { monaco, getWorker, model, worker }
      = createColorProviderHarness({
        text: 'text-red-5',
        workerResults: [stuckResult.promise],
      })
    const provider = createColorProvider(monaco, getWorker)
    const request = provider.provideDocumentColors(
      model,
      {} as unknown as import('monaco-types').CancellationToken,
    )

    await vi.waitFor(() => {
      expect(worker.getDocumentColors).toHaveBeenCalledOnce()
    })
    provider.reset()

    await expect(settleSoon(Promise.resolve(request))).resolves.toEqual({
      status: 'resolved',
      value: undefined,
    })
  })

  it('rolls back colors when reset re-enters through deltaDecorations', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const { monaco, getWorker, model, deltaDecorations }
      = createColorProviderHarness({
        decorationIds: ['stale-decoration'],
        lsColors: [lsColor],
        text: 'text-red-5',
      })
    const provider = createColorProvider(monaco, getWorker)
    let reentered = false
    deltaDecorations.mockImplementation((_oldDecorations, newDecorations) => {
      if (newDecorations.length > 0 && !reentered) {
        reentered = true
        provider.reset()
        return ['stale-decoration']
      }

      return []
    })

    await expect(provider.provideDocumentColors(
      model,
      {} as unknown as import('monaco-types').CancellationToken,
    )).resolves.toBeUndefined()

    expect(deltaDecorations).toHaveBeenLastCalledWith(['stale-decoration'], [])
    expect(document.adoptedStyleSheets[0].cssRules).toHaveLength(0)
  })

  it('absorbs a worker-accessor rejection caused by color-provider disposal', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const workerResult = createDeferred<UnocssWorker>()
    const { monaco, model }
      = createColorProviderHarness({ text: 'text-red-5' })
    const provider = createColorProvider(monaco, () => workerResult.promise)
    const request = provider.provideDocumentColors(
      model,
      {} as unknown as import('monaco-types').CancellationToken,
    )

    provider.dispose()
    workerResult.reject(new Error('worker disposed'))

    await expect(request).resolves.toBeUndefined()
  })

  it('clears non-editable colors when a model changes language', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const { monaco, getWorker, model, deltaDecorations }
      = createColorProviderHarness({
        decorationIds: ['theme-color-decoration'],
        lsColors: [lsColor],
        text: 'text-red-5',
      })
    const provider = createColorProvider(monaco, getWorker)
    const token = {} as unknown as import('monaco-types').CancellationToken

    await provider.provideDocumentColors(model, token)
    const onLanguageChange = vi.mocked(monaco.editor.onDidChangeModelLanguage).mock.calls[0][0]
    onLanguageChange({ model, oldLanguage: 'html' })

    expect(deltaDecorations).toHaveBeenLastCalledWith(['theme-color-decoration'], [])
  })

  it('does not let a stale request replace newer colors or their last-known-good cache', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const staleResult = createDeferred<WorkerFeatureResult<ColorInformation>>()
    const currentResult = createDeferred<WorkerFeatureResult<ColorInformation>>()
    const currentColor: ColorInformation = {
      ...lsColor,
      range: {
        start: { line: 0, character: 25 },
        end: { line: 0, character: 35 },
      },
    }
    let version = 1
    const { monaco, getWorker, model, deltaDecorations, worker }
      = createColorProviderHarness({
        getVersionId: () => version,
        text: 'bg-[hotpink]',
        workerResults: [
          staleResult.promise,
          currentResult.promise,
          { ok: false },
        ],
      })
    const provider = createColorProvider(monaco, getWorker)
    const token = {} as unknown as import('monaco-types').CancellationToken

    const staleRequest = provider.provideDocumentColors(model, token)
    await vi.waitFor(() => {
      expect(worker.getDocumentColors).toHaveBeenCalledOnce()
    })
    version = 2
    const currentRequest = provider.provideDocumentColors(model, token)
    currentResult.resolve({ ok: true, value: [currentColor] })
    const current = await currentRequest
    staleResult.resolve({ ok: true, value: [lsColor] })
    await staleRequest

    expect(deltaDecorations).toHaveBeenCalledTimes(1)

    const preserved = await provider.provideDocumentColors(model, token)

    expect(preserved).toBe(current)
    expect(preserved?.[0].range.startColumn).toBe(26)
  })

  it('releases color rules only after their last active decoration is replaced', async () => {
    const createColorProvider = await loadCreateColorProvider()
    const blueColor: ColorInformation = {
      ...lsColor,
      color: { red: 0, green: 0, blue: 1, alpha: 1 },
    }
    const { monaco, getWorker, model }
      = createColorProviderHarness({
        text: 'text-red-5',
        workerResults: [
          { ok: true, value: [lsColor] },
          { ok: true, value: [lsColor] },
          { ok: true, value: [blueColor] },
          { ok: true, value: [blueColor] },
        ],
      })
    const secondModel = {
      ...model,
      uri: 'file:///second.html',
      deltaDecorations: vi.fn(() => ['second-decoration']),
    } as unknown as editor.ITextModel
    const provider = createColorProvider(monaco, getWorker)
    const token = {} as unknown as import('monaco-types').CancellationToken

    await provider.provideDocumentColors(model, token)
    await provider.provideDocumentColors(secondModel, token)
    await provider.provideDocumentColors(model, token)

    expect(Array.from(
      document.adoptedStyleSheets[0].cssRules,
      rule => rule.cssText,
    )).toEqual([
      '.unocss-color-decoration-ff69b4ff{background-color:#ff69b4ff}',
      '.unocss-color-decoration-0000ffff{background-color:#0000ffff}',
    ])

    await provider.provideDocumentColors(secondModel, token)

    expect(Array.from(
      document.adoptedStyleSheets[0].cssRules,
      rule => rule.cssText,
    )).toEqual([
      '.unocss-color-decoration-0000ffff{background-color:#0000ffff}',
    ])

    provider.dispose()

    expect(document.adoptedStyleSheets[0].cssRules).toHaveLength(0)
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

describe('createMarkerDataProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves last-known-good markers on failure, then clears on successful empty', async () => {
    const createMarkerDataProvider = await loadCreateMarkerDataProvider()
    const diagnostic: Diagnostic = {
      message: 'conflicting utility',
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 16 },
      },
    }
    const results: Array<WorkerFeatureResult<Diagnostic>> = [
      { ok: true, value: [diagnostic] },
      { ok: false },
      { ok: true, value: [] },
    ]
    const worker = {
      doValidate: vi.fn(async () => results.shift()),
    } as unknown as UnocssWorker
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => 'html',
      getVersionId: () => 1,
      isDisposed: () => false,
    } as unknown as editor.ITextModel
    const provider = createMarkerDataProvider(async () => worker)

    const initial = await provider.provideMarkerData(model)
    const preserved = await provider.provideMarkerData(model)

    expect(initial).toEqual([expect.objectContaining({ message: 'conflicting utility' })])
    expect(preserved).toBe(initial)

    await expect(provider.provideMarkerData(model)).resolves.toEqual([])
  })

  it('does not call validation when disposal wins the worker-accessor race', async () => {
    const createMarkerDataProvider = await loadCreateMarkerDataProvider()
    const workerResult = createDeferred<UnocssWorker>()
    const doValidate = vi.fn(async () => ({ ok: true as const, value: [] }))
    const worker = { doValidate } as unknown as UnocssWorker
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => 'html',
      getVersionId: () => 1,
      isDisposed: () => false,
    } as unknown as editor.ITextModel
    const provider = createMarkerDataProvider(() => workerResult.promise)
    const request = provider.provideMarkerData(model)

    provider.dispose()
    workerResult.resolve(worker)

    await expect(request).resolves.toEqual([])
    expect(doValidate).not.toHaveBeenCalled()
  })

  it('settles an in-flight marker request when provider disposal invalidates a stuck RPC', async () => {
    const createMarkerDataProvider = await loadCreateMarkerDataProvider()
    const stuckResult = createDeferred<WorkerFeatureResult<Diagnostic>>()
    const doValidate = vi.fn(async () => stuckResult.promise)
    const worker = { doValidate } as unknown as UnocssWorker
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => 'html',
      getVersionId: () => 1,
      isDisposed: () => false,
    } as unknown as editor.ITextModel
    const provider = createMarkerDataProvider(async () => worker)
    const request = provider.provideMarkerData(model)

    await vi.waitFor(() => {
      expect(doValidate).toHaveBeenCalledOnce()
    })
    provider.dispose()

    await expect(settleSoon(Promise.resolve(request))).resolves.toEqual({
      status: 'resolved',
      value: [],
    })
  })

  it('does not let an older request replace newer last-known-good markers', async () => {
    const createMarkerDataProvider = await loadCreateMarkerDataProvider()
    const staleResult = createDeferred<WorkerFeatureResult<Diagnostic>>()
    const currentResult = createDeferred<WorkerFeatureResult<Diagnostic>>()
    const diagnostic = (message: string): Diagnostic => ({
      message,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 16 },
      },
    })
    const results: Array<
      Promise<WorkerFeatureResult<Diagnostic>> | WorkerFeatureResult<Diagnostic>
    > = [staleResult.promise, currentResult.promise, { ok: false }]
    const worker = {
      doValidate: vi.fn(async () => await results.shift()),
    } as unknown as UnocssWorker
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => 'html',
      getVersionId: () => 1,
      isDisposed: () => false,
    } as unknown as editor.ITextModel
    const provider = createMarkerDataProvider(async () => worker)

    const staleRequest = provider.provideMarkerData(model)
    await vi.waitFor(() => {
      expect(worker.doValidate).toHaveBeenCalledOnce()
    })
    const currentRequest = provider.provideMarkerData(model)
    currentResult.resolve({ ok: true, value: [diagnostic('current')] })
    const current = await currentRequest
    staleResult.resolve({ ok: true, value: [diagnostic('stale')] })
    await staleRequest

    const preserved = await provider.provideMarkerData(model)

    expect(preserved).toBe(current)
    expect(preserved).toEqual([expect.objectContaining({ message: 'current' })])
  })

  it('lets a new-language validation commit when reset follows the new request', async () => {
    const createMarkerDataProvider = await loadCreateMarkerDataProvider()
    const currentResult = createDeferred<WorkerFeatureResult<Diagnostic>>()
    const diagnostic = (message: string): Diagnostic => ({
      message,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 16 },
      },
    })
    const results: Array<
      Promise<WorkerFeatureResult<Diagnostic>> | WorkerFeatureResult<Diagnostic>
    > = [
      { ok: true, value: [diagnostic('old language')] },
      currentResult.promise,
      { ok: false },
    ]
    const worker = {
      doValidate: vi.fn(async () => await results.shift()),
    } as unknown as UnocssWorker
    let languageId = 'html'
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => languageId,
      getVersionId: () => 1,
      isDisposed: () => false,
    } as unknown as editor.ITextModel
    const provider = createMarkerDataProvider(async () => worker)

    await provider.provideMarkerData(model)
    languageId = 'javascript'
    const currentRequest = provider.provideMarkerData(model)
    provider.doReset?.(model)
    currentResult.resolve({ ok: true, value: [diagnostic('new language')] })

    const current = await currentRequest

    expect(current).toEqual([
      expect.objectContaining({ message: 'new language' }),
    ])
    await expect(provider.provideMarkerData(model)).resolves.toBe(current)
  })
})
