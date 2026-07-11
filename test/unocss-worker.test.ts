import type { MonacoUnocssOptions, UnocssWorkerOptions } from '../src/types/configure'
import type { UnocssWorker } from '../src/types/worker'
import { presetWind3 } from 'unocss'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialize } from '../src/unocss.worker'

const initializeWorker = vi.hoisted(() => vi.fn())

vi.mock('monaco-editor/esm/vs/common/initialize.js', () => ({
  initialize: initializeWorker,
}))

function createWorker(
  options: MonacoUnocssOptions,
  workerOptions?: UnocssWorkerOptions,
): UnocssWorker {
  initialize(workerOptions)
  const onMessage = globalThis.onmessage
  if (!onMessage) {
    throw new Error('Missing worker message handler')
  }

  ;(onMessage as (event: MessageEvent) => void)({} as MessageEvent)
  const createWorker = initializeWorker.mock.calls[0]?.[0]
  if (!createWorker)
    throw new Error('Missing Monaco worker initializer')

  return createWorker(
    { getMirrorModels: () => [] },
    options,
  ) as UnocssWorker
}

describe('unocss worker initialization', () => {
  beforeEach(() => {
    initializeWorker.mockClear()
  })

  it('passes config source byte-identically to the hook and uses its result', async () => {
    const configSource = '/* π */\r\nexport default { presets: [] }\n'
    const prepareUnocssConfig = vi.fn((receivedConfig?: string | object) => {
      expect(receivedConfig).toBe(configSource)
      return { presets: [presetWind3()] }
    })
    const worker = createWorker(
      { unocssConfig: configSource },
      { prepareUnocssConfig },
    )

    const css = await worker.generateStylesFromContent(
      ['<div class="mt-2"></div>'],
      { preflights: false, safelist: false },
    )

    expect(prepareUnocssConfig).toHaveBeenCalledExactlyOnceWith(configSource)
    expect(css).toContain('.mt-2')
    expect(css).toContain('margin-top:0.5rem')
  })

  it('rejects config source when no hook interprets it', () => {
    expect(() => createWorker({ unocssConfig: 'export default {}' })).toThrow(
      'Expected unocssConfig to resolve to an object, but got: "export default {}"',
    )
  })
})
