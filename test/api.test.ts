// @env node
import type { UserConfig } from '@unocss/core'
import type { UnocssConfig } from '../src/index'
import type { UnocssWorkerOptions } from '../src/unocss.worker'
import { guardStaleBuild } from 'tsdown-stale-guard'
import { snapshotApiPerEntry } from 'tsnapi/vitest'
import { beforeAll, describe, expectTypeOf, it } from 'vitest'

describe('api', async () => {
  beforeAll(async () => {
    await guardStaleBuild()
  })

  await snapshotApiPerEntry(new URL('..', import.meta.url).pathname)
})

it('publishes string config worker types', () => {
  type PrepareInput = Parameters<NonNullable<UnocssWorkerOptions['prepareUnocssConfig']>>[0]

  expectTypeOf<UnocssConfig>().toEqualTypeOf<UserConfig | string>()
  expectTypeOf<PrepareInput>().toEqualTypeOf<UnocssConfig | undefined>()
})
