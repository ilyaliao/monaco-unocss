// @env node
import type { WorkerFeatureResult } from '../src/types/worker'
import { describe, expect, it } from 'vitest'
import { decidePreserveOrClear } from '../src/preserve-or-clear'

describe('decidePreserveOrClear', () => {
  it('preserves the last-known-good layer when the computation failed', () => {
    expect(decidePreserveOrClear<number>({ ok: false })).toEqual({ kind: 'preserve' })
  })

  it('preserves the last-known-good layer when no mirror model matched', () => {
    expect(decidePreserveOrClear<number>(undefined)).toEqual({ kind: 'preserve' })
  })

  it('clears the layer when the computation genuinely produced nothing', () => {
    const result: WorkerFeatureResult<number> = { ok: true, value: [] }

    expect(decidePreserveOrClear(result)).toEqual({ kind: 'clear' })
  })

  it('sets the layer to the produced items when the computation has data', () => {
    const result: WorkerFeatureResult<number> = { ok: true, value: [1, 2, 3] }

    expect(decidePreserveOrClear(result)).toEqual({ kind: 'set', items: [1, 2, 3] })
  })
})
