import type { UserConfig } from '@unocss/core'
// @env node
import { presetWind3 } from 'unocss'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDocumentColors } from '../src/worker/colors'
import { runDocumentLayerFeature } from '../src/worker/document-feature-result'
import { createDocumentSessionFactory } from '../src/worker/document-session'

const uri = 'file:///worker-feature-result.html'

function createSession(source: string, config: UserConfig) {
  const factory = createDocumentSessionFactory(
    () => [{ getValue: () => source, uri, version: 0 }],
    config,
  )

  return factory.resolveDocument(uri, 'html')
}

describe('runDocumentLayerFeature', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reports generator initialization failure distinctly for validation and colors', async () => {
    const session = createSession('<div class="mt-2 mt-4"></div>', {
      presets: [async () => {
        throw new Error('broken preset')
      }],
    })

    const result = await runDocumentLayerFeature(session, current => getDocumentColors(current))

    expect(result).toEqual({ ok: false })
  })

  it('reports genuinely empty document colors as successful empty', async () => {
    const session = createSession('<div class="mt-2 mb-4"></div>', {
      presets: [presetWind3()],
    })

    const result = await runDocumentLayerFeature(session, current => getDocumentColors(current))

    expect(result).toEqual({ ok: true, value: [] })
  })

  it('keeps a missing mirror model distinct from feature failure', async () => {
    const result = await runDocumentLayerFeature(undefined, current => getDocumentColors(current))

    expect(result).toBeUndefined()
    expect(result).not.toEqual({ ok: false })
  })

  it('reports matched-position failure for document colors', async () => {
    const session = createSession('<div class="text-red-5"></div>', {
      presets: [presetWind3()],
      transformers: [{
        name: 'broken-matched-positions',
        transform() {
          throw new Error('broken matched positions')
        },
      }],
    })

    const result = await runDocumentLayerFeature(session, current => getDocumentColors(current))

    expect(result).toEqual({ ok: false })
  })

  it('reports a genuinely colorless document as successful empty', async () => {
    const session = createSession('<div class="mt-2"></div>', {
      presets: [presetWind3()],
    })

    const result = await runDocumentLayerFeature(session, current => getDocumentColors(current))

    expect(result).toEqual({ ok: true, value: [] })
  })

  it('memoizes repeated color generation errors as one failed result', async () => {
    const utility = 'text-red-5'
    const source = `<div class="${Array.from({ length: 500 }).fill(utility).join(' ')}"></div>`
    const session = createSession(source, {
      presets: [presetWind3()],
    })!
    const generator = await session.getGenerator()
    let generateCalls = 0
    const failingSession = {
      ...session,
      getGenerator: async () => ({
        config: generator!.config,
        async generate() {
          generateCalls++
          throw new Error('color generation failed')
        },
      } as unknown as NonNullable<typeof generator>),
    }

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await runDocumentLayerFeature(failingSession, getDocumentColors)

    expect(result).toEqual({ ok: false })
    expect(generateCalls).toBe(1)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('keeps successfully extracted colors when another utility fails', async () => {
    const source = '<div class="text-red-5 broken-color"></div>'
    const session = createSession(source, {
      presets: [presetWind3()],
      rules: [['broken-color', { color: 'blue' }]],
    })!
    const generator = await session.getGenerator()
    const failingSession = {
      ...session,
      getGenerator: async () => ({
        config: generator!.config,
        generate(tokens: Set<string>, options: object) {
          if (tokens.has('broken-color'))
            throw new Error('broken color failed')
          return generator!.generate(tokens, options)
        },
      } as unknown as NonNullable<typeof generator>),
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await runDocumentLayerFeature(failingSession, getDocumentColors)

    expect(result).toEqual({
      ok: true,
      value: [expect.objectContaining({
        range: expect.any(Object),
      })],
    })
    expect(warn).toHaveBeenCalledOnce()
  })

  it('preserves last-known-good colors when only non-color utilities succeed', async () => {
    const source = '<div class="mt-2 broken-color"></div>'
    const session = createSession(source, {
      presets: [presetWind3()],
      rules: [['broken-color', { color: 'blue' }]],
    })!
    const generator = await session.getGenerator()
    const failingSession = {
      ...session,
      getGenerator: async () => ({
        config: generator!.config,
        generate(tokens: Set<string>, options: object) {
          if (tokens.has('broken-color'))
            throw new Error('broken color failed')
          return generator!.generate(tokens, options)
        },
      } as unknown as NonNullable<typeof generator>),
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await runDocumentLayerFeature(failingSession, getDocumentColors)

    expect(result).toEqual({ ok: false })
  })
})
