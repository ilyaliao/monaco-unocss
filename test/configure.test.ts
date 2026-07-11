import type { editor, languages } from 'monaco-types'
import type { MonacoUnocssMonacoEditor } from '../src/types/configure'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeferred, createDisposable, settleSoon, setupDomGlobals } from './helpers'

async function loadConfigureMonacoUnocss() {
  setupDomGlobals()
  vi.resetModules()

  return await import('../src/index')
}

describe('configureMonacoUnocss', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates the UnoCSS worker through Monaco createWebWorker', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const firstGenerateStyles = vi.fn(async () => '.first{}')
    const secondGenerateStyles = vi.fn(async () => '.second{}')
    const firstWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({
        generateStylesFromContent: firstGenerateStyles,
      })),
    }
    const secondWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({
        generateStylesFromContent: secondGenerateStyles,
      })),
    }
    const createWebWorker = vi.fn()
      .mockReturnValueOnce(firstWorker)
      .mockReturnValueOnce(secondWorker)
    const monaco = {
      createWebWorker,
      editor: {
        getModels: vi.fn(() => []),
        onDidChangeModelLanguage: vi.fn(createDisposable),
        onDidCreateModel: vi.fn(createDisposable),
        onWillDisposeModel: vi.fn(createDisposable),
        setModelMarkers: vi.fn(),
      },
      languages: {
        registerCodeActionProvider: vi.fn(createDisposable),
        registerColorProvider: vi.fn(createDisposable),
        registerCompletionItemProvider: vi.fn(createDisposable),
        registerHoverProvider: vi.fn(createDisposable),
      },
    } as unknown as MonacoUnocssMonacoEditor
    const unocssConfig = { shortcuts: { btn: 'px-2' } }

    const integration = configureMonacoUnocss(monaco, { unocssConfig })

    const generateOptions = { preflights: false }
    await expect(integration.generateStylesFromContent([
      '<div class="btn"></div>',
      { content: '<section class="card"></section>', extension: 'html' },
    ], generateOptions))
      .resolves
      .toBe('.first{}')
    expect(firstGenerateStyles).toHaveBeenCalledExactlyOnceWith([
      { content: '<div class="btn"></div>' },
      { content: '<section class="card"></section>', extension: 'html' },
    ], generateOptions)

    expect(createWebWorker).toHaveBeenCalledWith({
      createData: { unocssConfig },
      label: 'unocss',
      moduleId: 'monaco-unocss/unocss.worker',
    })

    const nextConfig = 'export default { shortcuts: { card: "p-4" } }'
    integration.setUnocssConfig(nextConfig)

    expect(firstWorker.dispose).toHaveBeenCalledOnce()

    await expect(
      integration.generateStylesFromContent(['<div class="card"></div>']),
    )
      .resolves
      .toBe('.second{}')
    expect(createWebWorker).toHaveBeenLastCalledWith({
      createData: { unocssConfig: nextConfig },
      label: 'unocss',
      moduleId: 'monaco-unocss/unocss.worker',
    })

    integration.dispose()

    expect(secondWorker.dispose).toHaveBeenCalledOnce()
  })

  it('rejects public work after disposal without recreating the worker', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const createWebWorker = vi.fn(() => ({
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({
        generateStylesFromContent: vi.fn(async () => ''),
      })),
    }))
    const monaco = {
      createWebWorker,
      editor: {
        getModels: vi.fn(() => []),
        onDidChangeModelLanguage: vi.fn(createDisposable),
        onDidCreateModel: vi.fn(createDisposable),
        onWillDisposeModel: vi.fn(createDisposable),
        setModelMarkers: vi.fn(),
      },
      languages: {
        registerCodeActionProvider: vi.fn(createDisposable),
        registerColorProvider: vi.fn(createDisposable),
        registerCompletionItemProvider: vi.fn(createDisposable),
        registerHoverProvider: vi.fn(createDisposable),
      },
    } as unknown as MonacoUnocssMonacoEditor

    const integration = configureMonacoUnocss(monaco)
    integration.dispose()

    await expect(integration.setUnocssConfig({})).rejects.toThrow(
      'monaco-unocss integration has been disposed',
    )
    await expect(integration.generateStylesFromContent(['text-red-5'])).rejects.toThrow(
      'monaco-unocss integration has been disposed',
    )
    expect(createWebWorker).not.toHaveBeenCalled()
  })

  it('settles a stuck hover from the replaced worker generation', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const stuckHover = createDeferred<never>()
    const doHover = vi.fn(async () => stuckHover.promise)
    const worker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({ doHover })),
    }
    const registerHoverProvider = vi.fn((..._args: unknown[]) => createDisposable())
    const monaco = {
      createWebWorker: vi.fn(() => worker),
      editor: {
        getModels: vi.fn(() => []),
        onDidChangeModelLanguage: vi.fn(createDisposable),
        onDidCreateModel: vi.fn(createDisposable),
        onWillDisposeModel: vi.fn(createDisposable),
        setModelMarkers: vi.fn(),
      },
      languages: {
        registerCodeActionProvider: vi.fn(createDisposable),
        registerColorProvider: vi.fn(createDisposable),
        registerCompletionItemProvider: vi.fn(createDisposable),
        registerHoverProvider,
      },
    } as unknown as MonacoUnocssMonacoEditor
    const integration = configureMonacoUnocss(monaco)
    const provider = registerHoverProvider.mock.calls[0]?.[1] as languages.HoverProvider
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => 'html',
    } as unknown as editor.ITextModel
    const request = provider.provideHover(
      model,
      { lineNumber: 1, column: 1 } as unknown as import('monaco-types').Position,
      {} as unknown as import('monaco-types').CancellationToken,
    )

    await vi.waitFor(() => {
      expect(doHover).toHaveBeenCalledOnce()
    })
    await integration.setUnocssConfig({})

    await expect(settleSoon(Promise.resolve(request))).resolves.toEqual({
      status: 'resolved',
      value: undefined,
    })
    integration.dispose()
  })

  it('rejects stuck style generation when the integration is disposed', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const stuckStyles = createDeferred<never>()
    const generateStylesFromContent = vi.fn(async () => stuckStyles.promise)
    const worker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({ generateStylesFromContent })),
    }
    const monaco = {
      createWebWorker: vi.fn(() => worker),
      editor: {
        getModels: vi.fn(() => []),
        onDidChangeModelLanguage: vi.fn(createDisposable),
        onDidCreateModel: vi.fn(createDisposable),
        onWillDisposeModel: vi.fn(createDisposable),
        setModelMarkers: vi.fn(),
      },
      languages: {
        registerCodeActionProvider: vi.fn(createDisposable),
        registerColorProvider: vi.fn(createDisposable),
        registerCompletionItemProvider: vi.fn(createDisposable),
        registerHoverProvider: vi.fn(createDisposable),
      },
    } as unknown as MonacoUnocssMonacoEditor
    const integration = configureMonacoUnocss(monaco)
    const request = integration.generateStylesFromContent(['text-red-5'])

    await vi.waitFor(() => {
      expect(generateStylesFromContent).toHaveBeenCalledOnce()
    })
    integration.dispose()

    const settlement = await settleSoon(request)
    expect(settlement.status).toBe('rejected')
    expect(settlement).toMatchObject({
      reason: expect.objectContaining({
        message: expect.stringContaining('worker generation was invalidated'),
      }),
    })
  })

  it('refreshes document colors after setUnocssConfig without a document edit', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const firstColorRegistration = createDisposable()
    const secondColorRegistration = createDisposable()
    const colorModelDisposeListener = createDisposable()
    const registerColorProvider = vi.fn()
      .mockReturnValueOnce(firstColorRegistration)
      .mockReturnValueOnce(secondColorRegistration)
    const onWillDisposeModel = vi.fn()
      .mockReturnValueOnce(colorModelDisposeListener)
      .mockImplementation(createDisposable)
    const monaco = {
      createWebWorker: vi.fn(),
      editor: {
        getModels: vi.fn(() => []),
        onDidChangeModelLanguage: vi.fn(createDisposable),
        onDidCreateModel: vi.fn(createDisposable),
        onWillDisposeModel,
        setModelMarkers: vi.fn(),
      },
      languages: {
        registerCodeActionProvider: vi.fn(createDisposable),
        registerColorProvider,
        registerCompletionItemProvider: vi.fn(createDisposable),
        registerHoverProvider: vi.fn(createDisposable),
      },
    } as unknown as MonacoUnocssMonacoEditor

    const integration = configureMonacoUnocss(monaco)
    const initialProvider = registerColorProvider.mock.calls[0]?.[1]

    await integration.setUnocssConfig({ theme: { colors: { brand: '#123456' } } })

    expect(firstColorRegistration.dispose).toHaveBeenCalledOnce()
    expect(registerColorProvider).toHaveBeenCalledTimes(2)
    expect(registerColorProvider.mock.calls[1]?.[1]).toBe(initialProvider)
    expect(secondColorRegistration.dispose).not.toHaveBeenCalled()

    integration.dispose()

    expect(secondColorRegistration.dispose).toHaveBeenCalledOnce()
    expect(colorModelDisposeListener.dispose).toHaveBeenCalledOnce()
  })

  it('does not let an old-config color result overwrite the refreshed provider state', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const staleResult = createDeferred<{
      ok: true
      value: Array<{
        color: { alpha: number, blue: number, green: number, red: number }
        range: { end: { character: number, line: number }, start: { character: number, line: number } }
      }>
    }>()
    const range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 10 },
    }
    const staleProxy = {
      getDocumentColors: vi.fn(async () => staleResult.promise),
    }
    const currentProxy = {
      getDocumentColors: vi.fn(async () => ({
        ok: true as const,
        value: [{
          range,
          color: { red: 0, green: 0, blue: 1, alpha: 1 },
        }],
      })),
    }
    const firstWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => staleProxy),
    }
    const secondWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => currentProxy),
    }
    const deltaDecorations = vi.fn(() => ['color-decoration'])
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => 'html',
      getVersionId: () => 1,
      getValueInRange: () => 'text-brand',
      isDisposed: () => false,
      deltaDecorations,
    } as unknown as editor.ITextModel
    const registerColorProvider = vi.fn((..._args: unknown[]) => createDisposable())
    const monaco = {
      createWebWorker: vi.fn()
        .mockReturnValueOnce(firstWorker)
        .mockReturnValueOnce(secondWorker),
      editor: {
        getModels: vi.fn(() => []),
        onDidChangeModelLanguage: vi.fn(createDisposable),
        onDidCreateModel: vi.fn(createDisposable),
        onWillDisposeModel: vi.fn(createDisposable),
        setModelMarkers: vi.fn(),
      },
      languages: {
        registerCodeActionProvider: vi.fn(createDisposable),
        registerColorProvider,
        registerCompletionItemProvider: vi.fn(createDisposable),
        registerHoverProvider: vi.fn(createDisposable),
      },
    } as unknown as MonacoUnocssMonacoEditor
    const integration = configureMonacoUnocss(monaco)
    const provider = registerColorProvider.mock.calls[0]?.[1] as languages.DocumentColorProvider
    const token = {} as unknown as import('monaco-types').CancellationToken

    const staleRequest = provider.provideDocumentColors(model, token)
    await vi.waitFor(() => {
      expect(staleProxy.getDocumentColors).toHaveBeenCalledOnce()
    })

    await integration.setUnocssConfig({ theme: { colors: { brand: '#0000ff' } } })
    staleResult.resolve({
      ok: true,
      value: [{
        range,
        color: { red: 1, green: 105 / 255, blue: 180 / 255, alpha: 1 },
      }],
    })
    await staleRequest

    expect(deltaDecorations).toHaveBeenCalledOnce()
    expect(deltaDecorations).toHaveBeenLastCalledWith([], [])
    expect(document.adoptedStyleSheets[0].cssRules).toHaveLength(0)

    await provider.provideDocumentColors(model, token)

    expect(deltaDecorations).toHaveBeenCalledTimes(2)
    expect(deltaDecorations).toHaveBeenLastCalledWith(
      [],
      [expect.objectContaining({
        options: {
          before: expect.objectContaining({
            inlineClassName: expect.stringContaining('unocss-color-decoration-0000ffff'),
          }),
        },
      })],
    )
    expect(Array.from(
      document.adoptedStyleSheets[0].cssRules,
      rule => rule.cssText,
    )).toEqual([
      '.unocss-color-decoration-0000ffff{background-color:#0000ffff}',
    ])

    integration.dispose()
  })

  it('rolls back a color commit that synchronously refreshes the config', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 10 },
    }
    const firstProxy = {
      getDocumentColors: vi.fn(async () => ({
        ok: true as const,
        value: [{
          range,
          color: { red: 1, green: 105 / 255, blue: 180 / 255, alpha: 1 },
        }],
      })),
    }
    const secondProxy = {
      getDocumentColors: vi.fn(async () => ({
        ok: true as const,
        value: [{
          range,
          color: { red: 0, green: 0, blue: 1, alpha: 1 },
        }],
      })),
    }
    const firstWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => firstProxy),
    }
    const secondWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => secondProxy),
    }
    let integration!: ReturnType<typeof configureMonacoUnocss>
    let configRefresh: Promise<void> | undefined
    const deltaDecorations = vi.fn((
      _oldDecorations: string[],
      newDecorations: editor.IModelDeltaDecoration[],
    ) => {
      if (newDecorations.length === 0)
        return []

      if (!configRefresh) {
        configRefresh = integration.setUnocssConfig({})
        return ['stale-decoration']
      }

      return ['current-decoration']
    })
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => 'html',
      getVersionId: () => 1,
      getValueInRange: () => 'text-brand',
      isDisposed: () => false,
      deltaDecorations,
    } as unknown as editor.ITextModel
    const registerColorProvider = vi.fn((..._args: unknown[]) => createDisposable())
    const monaco = {
      createWebWorker: vi.fn()
        .mockReturnValueOnce(firstWorker)
        .mockReturnValueOnce(secondWorker),
      editor: {
        getModels: vi.fn(() => []),
        onDidChangeModelLanguage: vi.fn(createDisposable),
        onDidCreateModel: vi.fn(createDisposable),
        onWillDisposeModel: vi.fn(createDisposable),
        setModelMarkers: vi.fn(),
      },
      languages: {
        registerCodeActionProvider: vi.fn(createDisposable),
        registerColorProvider,
        registerCompletionItemProvider: vi.fn(createDisposable),
        registerHoverProvider: vi.fn(createDisposable),
      },
    } as unknown as MonacoUnocssMonacoEditor
    integration = configureMonacoUnocss(monaco)
    const provider = registerColorProvider.mock.calls[0]?.[1] as languages.DocumentColorProvider
    const token = {} as unknown as import('monaco-types').CancellationToken

    await expect(provider.provideDocumentColors(model, token)).resolves.toBeUndefined()
    await configRefresh

    expect(deltaDecorations).toHaveBeenCalledWith(['stale-decoration'], [])
    expect(document.adoptedStyleSheets[0].cssRules).toHaveLength(0)

    await provider.provideDocumentColors(model, token)

    expect(deltaDecorations).toHaveBeenLastCalledWith(
      [],
      [expect.objectContaining({
        options: {
          before: expect.objectContaining({
            inlineClassName: expect.stringContaining('unocss-color-decoration-0000ffff'),
          }),
        },
      })],
    )
    expect(Array.from(
      document.adoptedStyleSheets[0].cssRules,
      rule => rule.cssText,
    )).toEqual([
      '.unocss-color-decoration-0000ffff{background-color:#0000ffff}',
    ])

    integration.dispose()
  })

  it('requires the monaco-editor createWebWorker entry', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const monaco = {
      createWebWorker: undefined,
    } as unknown as MonacoUnocssMonacoEditor

    expect(() => configureMonacoUnocss(monaco)).toThrow(
      'monaco-unocss requires monaco.createWebWorker from monaco-editor',
    )
  })
})
