import type { UserConfig } from '@unocss/core'
// @env node
import { presetWind3 } from 'unocss'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDocumentColors } from '../src/worker/colors'
import { runDocumentLayerFeature } from '../src/worker/document-feature-result'
import { createDocumentSessionFactory } from '../src/worker/document-session'

const uri = 'file:///document-session.html'

function createFactory(config: UserConfig) {
  return createDocumentSessionFactory(
    () => [{
      getValue: () => '<div class="mt-2 mt-4 text-red-5"></div>',
      uri,
      version: 0,
    }],
    config,
  )
}

describe('document session generator initialization', () => {
  afterEach(() => vi.restoreAllMocks())

  it('reports one shared failure across features without poisoning a replacement factory', async () => {
    const cause = new Error('broken preset')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failingFactory = createFactory({
      presets: [async () => {
        throw cause
      }],
    })
    const failingSession = failingFactory.resolveDocument(uri, 'html')!

    const results = await Promise.all([
      runDocumentLayerFeature(failingSession, getDocumentColors),
      failingFactory.getGeneratorResult(),
    ])

    expect(results).toEqual([
      { ok: false },
      { cause },
    ])
    expect(error).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledWith(
      'monaco-unocss failed to initialize the UnoCSS generator',
      cause,
    )

    const replacementSession = createFactory({ presets: [presetWind3()] })
      .resolveDocument(uri, 'html')!

    await expect(
      runDocumentLayerFeature(replacementSession, getDocumentColors),
    ).resolves.toEqual({ ok: true, value: expect.any(Array) })
    expect(error).toHaveBeenCalledOnce()
  })
})

describe('document session language identity', () => {
  it('recomputes matched positions when only the model language changes', async () => {
    const source = 'div.float-left'
    const languageUri = 'file:///language-switch.html'
    const model = { getValue: () => source, uri: languageUri, version: 0 }
    const factory = createDocumentSessionFactory(
      () => [model],
      {
        blocklist: [/^float-/],
        extractors: [{
          name: 'pug',
          extract(context) {
            context.code = '<div class="float-left"></div>'
          },
        }],
        presets: [presetWind3()],
      },
    )

    const htmlPositions = await factory
      .resolveDocument(languageUri, 'html')!
      .getMatchedPositions()
    const pugPositions = await factory
      .resolveDocument(languageUri, 'pug')!
      .getMatchedPositions()

    expect(htmlPositions).toEqual([])
    expect(pugPositions).toEqual([[4, 14, 'float-left']])
  })
})
