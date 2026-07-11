import type { WorkerFeatureResult } from './types/worker'

export type LayerDecision<T>
  = | { kind: 'set', items: T[] }
    | { kind: 'clear' }
    | { kind: 'preserve' }

export function decidePreserveOrClear<T>(
  result: WorkerFeatureResult<T> | undefined,
): LayerDecision<T> {
  if (!result || !result.ok)
    return { kind: 'preserve' }

  if (result.value.length === 0)
    return { kind: 'clear' }

  return { kind: 'set', items: result.value }
}
