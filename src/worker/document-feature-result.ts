import type { WorkerFeatureResult } from '../types/worker'
import type { DocumentSession } from './document-session'

export async function runDocumentLayerFeature<T>(
  session: DocumentSession | undefined,
  feature: (session: DocumentSession) => Promise<T[] | undefined> | T[] | undefined,
): Promise<WorkerFeatureResult<T> | undefined> {
  if (!session)
    return undefined

  const value = await feature(session)

  return value === undefined ? { ok: false } : { ok: true, value }
}
