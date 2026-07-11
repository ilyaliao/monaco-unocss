// @env node
import { guardStaleBuild } from 'tsdown-stale-guard'
import { snapshotApiPerEntry } from 'tsnapi/vitest'
import { beforeAll, describe } from 'vitest'

describe('api', async () => {
  beforeAll(async () => {
    await guardStaleBuild()
  })

  await snapshotApiPerEntry(new URL('..', import.meta.url).pathname)
})
