// @env node
import type { GenerateOptions, UserConfig } from '@unocss/core'
import type { configureMonacoUnocss, UnocssConfig } from '../src/index'
import type { Content } from '../src/types/configure'
import type { UnocssWorker } from '../src/types/worker'
import type { UnocssWorkerOptions } from '../src/unocss.worker'
import { fileURLToPath } from 'node:url'
import { guardStaleBuild } from 'tsdown-stale-guard'
import { snapshotApiPerEntry } from 'tsnapi/vitest'
import { beforeAll, describe, expectTypeOf, it } from 'vitest'

describe('api', async () => {
  beforeAll(async () => {
    await guardStaleBuild()
  })

  await snapshotApiPerEntry(fileURLToPath(new URL('..', import.meta.url)))
})

it('publishes string config worker types', () => {
  type PrepareInput = Parameters<NonNullable<UnocssWorkerOptions['prepareUnocssConfig']>>[0]

  expectTypeOf<UnocssConfig>().toEqualTypeOf<UserConfig | string>()
  expectTypeOf<PrepareInput>().toEqualTypeOf<UnocssConfig | undefined>()
})

it('binds Monaco worker create data to its declared payload type', () => {
  type PublicConfigureOptions = NonNullable<
    Parameters<typeof configureMonacoUnocss>[1]
  >
  type PublicWorkerCreateData = Pick<PublicConfigureOptions, 'unocssConfig'>
  type PublicMonacoEditor = Parameters<typeof configureMonacoUnocss>[0]
  interface PublicWorkerOptions {
    createData?: PublicWorkerCreateData
    label?: string
    moduleId: string
  }
  const createWebWorker = null as unknown as PublicMonacoEditor['createWebWorker']

  expectTypeOf(createWebWorker<UnocssWorker>)
    .parameter(0)
    .toEqualTypeOf<PublicWorkerOptions>()

  if (false) {
    createWebWorker<UnocssWorker>({
      moduleId: 'monaco-unocss/unocss.worker',
      // @ts-expect-error languageSelector is main-thread configuration, not worker create data.
      createData: { languageSelector: ['html'] },
    })
  }
})

it('uses the supported upstream UnoCSS generate options', () => {
  type PublicIntegration = ReturnType<typeof configureMonacoUnocss>
  type PublicGenerateOptions = NonNullable<
    Parameters<PublicIntegration['generateStylesFromContent']>[1]
  >
  type SupportedGenerateOptions = Pick<
    GenerateOptions<boolean>,
    'preflights' | 'safelist' | 'minify'
  >

  expectTypeOf<PublicGenerateOptions>()
    .toEqualTypeOf<SupportedGenerateOptions>()
})

it('normalizes public content strings before the worker RPC boundary', () => {
  type PublicIntegration = ReturnType<typeof configureMonacoUnocss>
  type PublicContents = Parameters<PublicIntegration['generateStylesFromContent']>[0]
  type WorkerContents = Parameters<UnocssWorker['generateStylesFromContent']>[0]

  expectTypeOf<PublicContents>().toEqualTypeOf<(Content | string)[]>()
  expectTypeOf<WorkerContents>().toEqualTypeOf<Content[]>()
})
