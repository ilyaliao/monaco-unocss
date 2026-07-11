import type { MonacoUnocssMonacoEditor } from '../src/types/configure'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDisposable, setupDomGlobals } from './helpers'

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
    const firstWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({
        generateStylesFromContent: vi.fn(async () => '.first{}'),
      })),
    }
    const secondWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({
        generateStylesFromContent: vi.fn(async () => '.second{}'),
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

    await expect(
      integration.generateStylesFromContent(['<div class="btn"></div>']),
    )
      .resolves
      .toBe('.first{}')

    expect(createWebWorker).toHaveBeenCalledWith({
      createData: { unocssConfig },
      label: 'unocss',
      moduleId: 'monaco-unocss/unocss.worker',
    })

    const nextConfig = { shortcuts: { card: 'p-4' } }
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

  it('revalidates markers after setUnocssConfig without a document edit', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => 'html',
      getVersionId: () => 1,
      isDisposed: () => false,
      onDidChangeContent: vi.fn(createDisposable),
    }
    const blockedDiagnostic = {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      message: 'blocked',
      severity: 2,
    }
    const firstProxy = {
      doValidate: vi.fn(async () => ({ ok: true as const, value: [blockedDiagnostic] })),
    }
    const firstWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => firstProxy),
    }
    const secondProxy = {
      doValidate: vi.fn(async () => ({ ok: true as const, value: [] })),
    }
    const secondWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => secondProxy),
    }
    const createWebWorker = vi.fn()
      .mockReturnValueOnce(firstWorker)
      .mockReturnValueOnce(secondWorker)
    const setModelMarkers = vi.fn()
    const monaco = {
      createWebWorker,
      editor: {
        getModels: vi.fn(() => [model]),
        onDidChangeModelLanguage: vi.fn(createDisposable),
        onDidCreateModel: vi.fn(createDisposable),
        onWillDisposeModel: vi.fn(createDisposable),
        setModelMarkers,
      },
      languages: {
        registerCodeActionProvider: vi.fn(createDisposable),
        registerColorProvider: vi.fn(createDisposable),
        registerCompletionItemProvider: vi.fn(createDisposable),
        registerHoverProvider: vi.fn(createDisposable),
      },
    } as unknown as MonacoUnocssMonacoEditor

    const integration = configureMonacoUnocss(monaco)

    await vi.waitFor(() => {
      expect(setModelMarkers).toHaveBeenCalledWith(
        model,
        'unocss',
        [expect.objectContaining({ message: 'blocked' })],
      )
    })

    expect(firstProxy.doValidate).toHaveBeenCalledTimes(1)

    setModelMarkers.mockClear()
    await integration.setUnocssConfig({})

    expect(setModelMarkers).toHaveBeenCalledWith(model, 'unocss', [])
    expect(secondProxy.doValidate).toHaveBeenCalledTimes(1)

    integration.dispose()
  })

  it('propagates revalidation failures through setUnocssConfig', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const model = {
      uri: 'file:///example.html',
      getLanguageId: () => 'html',
      getVersionId: () => 1,
      isDisposed: () => false,
      onDidChangeContent: vi.fn(createDisposable),
    }
    const firstWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({
        doValidate: vi.fn(async () => ({ ok: true as const, value: [] })),
      })),
    }
    const secondWorker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({
        doValidate: vi.fn(async () => {
          throw new Error('worker broke')
        }),
      })),
    }
    const monaco = {
      createWebWorker: vi.fn()
        .mockReturnValueOnce(firstWorker)
        .mockReturnValueOnce(secondWorker),
      editor: {
        getModels: vi.fn(() => [model]),
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

    await vi.waitFor(() => {
      expect(firstWorker.withSyncedResources).toHaveBeenCalled()
    })

    await expect(integration.setUnocssConfig({})).rejects.toThrow('worker broke')

    integration.dispose()
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

  it('registers a wildcard marker data provider for the "*" selector', async () => {
    const { configureMonacoUnocss } = await loadConfigureMonacoUnocss()
    const model = {
      uri: 'file:///example.vue',
      getLanguageId: () => 'vue',
      getVersionId: () => 1,
      isDisposed: () => false,
      onDidChangeContent: vi.fn(createDisposable),
    }
    const blockedDiagnostic = {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      message: 'blocked',
      severity: 2,
    }
    const worker = {
      dispose: vi.fn(),
      withSyncedResources: vi.fn(async () => ({
        doValidate: vi.fn(async () => ({ ok: true as const, value: [blockedDiagnostic] })),
      })),
    }
    const setModelMarkers = vi.fn()
    const monaco = {
      createWebWorker: vi.fn(() => worker),
      editor: {
        getModels: vi.fn(() => [model]),
        onDidChangeModelLanguage: vi.fn(createDisposable),
        onDidCreateModel: vi.fn(createDisposable),
        onWillDisposeModel: vi.fn(createDisposable),
        setModelMarkers,
      },
      languages: {
        registerCodeActionProvider: vi.fn(createDisposable),
        registerColorProvider: vi.fn(createDisposable),
        registerCompletionItemProvider: vi.fn(createDisposable),
        registerHoverProvider: vi.fn(createDisposable),
      },
    } as unknown as MonacoUnocssMonacoEditor

    const integration = configureMonacoUnocss(monaco, { languageSelector: '*' })

    await vi.waitFor(() => {
      expect(setModelMarkers).toHaveBeenCalledWith(
        model,
        'unocss',
        [expect.objectContaining({ message: 'blocked' })],
      )
    })

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
