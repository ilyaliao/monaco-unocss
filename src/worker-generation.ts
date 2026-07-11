import type { UnocssWorker } from './types/worker'

export interface WorkerGeneration {
  invalidate: () => void
  invalidated: Promise<void>
  isInvalidated: () => boolean
}

class WorkerGenerationInvalidatedError extends Error {
  override name = 'WorkerGenerationInvalidatedError'

  constructor() {
    super('monaco-unocss worker generation was invalidated')
  }
}

export function createWorkerGeneration(): WorkerGeneration {
  let invalidated = false
  let resolveInvalidated!: () => void
  const invalidation = new Promise<void>((resolve) => {
    resolveInvalidated = resolve
  })

  return {
    invalidate() {
      if (invalidated)
        return

      invalidated = true
      resolveInvalidated()
    },
    invalidated: invalidation,
    isInvalidated: () => invalidated,
  }
}

function callFeature<T>(
  client: Promise<UnocssWorker>,
  generation: WorkerGeneration,
  invoke: (worker: UnocssWorker) => Promise<T>,
): Promise<T | undefined> {
  if (generation.isInvalidated())
    return Promise.resolve(undefined)

  const operation = client.then((worker) => {
    if (generation.isInvalidated())
      return undefined

    return invoke(worker)
  })

  return Promise.race([
    operation,
    generation.invalidated.then(() => undefined),
  ])
}

function callStyleGeneration(
  client: Promise<UnocssWorker>,
  generation: WorkerGeneration,
  invoke: (worker: UnocssWorker) => Promise<string>,
): Promise<string> {
  if (generation.isInvalidated())
    return Promise.reject(new WorkerGenerationInvalidatedError())

  const operation = client.then((worker) => {
    if (generation.isInvalidated())
      throw new WorkerGenerationInvalidatedError()

    return invoke(worker)
  })

  return Promise.race([
    operation,
    generation.invalidated.then(() => {
      throw new WorkerGenerationInvalidatedError()
    }),
  ])
}

export function createWorkerGenerationClient(
  client: Promise<UnocssWorker>,
  generation: WorkerGeneration,
): UnocssWorker {
  return {
    doComplete: (...args) => callFeature(
      client,
      generation,
      worker => worker.doComplete(...args),
    ),
    doHover: (...args) => callFeature(
      client,
      generation,
      worker => worker.doHover(...args),
    ),
    generateStylesFromContent: (...args) => callStyleGeneration(
      client,
      generation,
      worker => worker.generateStylesFromContent(...args),
    ),
    getDocumentColors: (...args) => callFeature(
      client,
      generation,
      worker => worker.getDocumentColors(...args),
    ),
    resolveCompletionItem: (...args) => callFeature(
      client,
      generation,
      worker => worker.resolveCompletionItem(...args),
    ),
  }
}
