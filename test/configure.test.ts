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
