import type { UnocssAutocomplete } from '@unocss/autocomplete'
import type { UnoGenerator, UserConfig } from '@unocss/core'
import type { TextDocument as TextDocumentType } from 'vscode-languageserver-textdocument'
import { createAutocomplete } from '@unocss/autocomplete'
import { createGenerator } from '@unocss/core'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getMatchedPositionsFromCode } from '../vendor/match-positions'

export type MatchedPosition = readonly [start: number, end: number, text: string]

export interface DocumentSession {
  document: TextDocumentType
  getAutocomplete: () => Promise<UnocssAutocomplete | undefined>
  getGenerator: () => Promise<UnoGenerator<object> | undefined>
  getMatchedPositions: () => Promise<MatchedPosition[] | undefined>
}

export interface DocumentSessionFactory {
  getGenerator: () => Promise<UnoGenerator<object> | undefined>
  getGeneratorResult: () => Promise<GeneratorInitializationResult>
  resolveDocument: (uri: string, languageId: string) => DocumentSession | undefined
}

type GeneratorInitializationResult
  = | { cause: unknown }
    | { generator: UnoGenerator<object> }

interface MirrorModel {
  getValue: () => string
  readonly uri: unknown
  readonly version: number
}

interface MatchedPositionsCacheEntry {
  contentFingerprint: string
  entryToken: symbol
  languageId: string
  modelGeneration: ModelGeneration
  positions: Promise<MatchedPosition[] | undefined>
  version: number
}

interface ModelGeneration {
  model: MirrorModel
}

async function createUnoGenerator(
  config: UserConfig | PromiseLike<UserConfig>,
): Promise<UnoGenerator<object>> {
  return await createGenerator(await config)
}

function getContentFingerprint(code: string): string {
  let hash = 2166136261
  for (let index = 0; index < code.length; index++) {
    hash ^= code.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${code.length}:${hash >>> 0}`
}

async function computeMatchedPositions(
  uno: UnoGenerator<object>,
  document: TextDocumentType,
): Promise<MatchedPosition[]> {
  return await getMatchedPositionsFromCode(uno, document.getText(), document.uri)
}

export function createDocumentSessionFactory(
  getMirrorModels: () => MirrorModel[],
  unocssConfig: UserConfig | PromiseLike<UserConfig>,
): DocumentSessionFactory {
  const matchedPositionsCache = new Map<string, MatchedPositionsCacheEntry>()
  const modelGenerations = new Map<string, ModelGeneration>()
  let autocomplete: Promise<UnocssAutocomplete | undefined> | undefined
  let generator: Promise<UnoGenerator<object> | undefined> | undefined
  let generatorResult: Promise<GeneratorInitializationResult> | undefined

  const getGeneratorResult = (): Promise<GeneratorInitializationResult> =>
    generatorResult ??= createUnoGenerator(unocssConfig).then(
      (generator): GeneratorInitializationResult => ({ generator }),
      (cause): GeneratorInitializationResult => {
        console.error('monaco-unocss failed to initialize the UnoCSS generator', cause)
        return { cause }
      },
    )

  const getGenerator = (): Promise<UnoGenerator<object> | undefined> =>
    generator ??= getGeneratorResult().then(result =>
      'generator' in result ? result.generator : undefined,
    )

  const getAutocomplete = (): Promise<UnocssAutocomplete | undefined> =>
    autocomplete ??= getGenerator()
      .then(uno => uno ? createAutocomplete(uno) : undefined)
      .catch(() => undefined)

  function reconcileModelGenerations(activeModels: MirrorModel[]): Map<string, MirrorModel> {
    const activeModelsByUri = new Map<string, MirrorModel>()
    for (const model of activeModels) {
      const uri = String(model.uri)
      if (!activeModelsByUri.has(uri))
        activeModelsByUri.set(uri, model)
    }

    for (const [uri, generation] of modelGenerations) {
      if (activeModelsByUri.get(uri) !== generation.model) {
        modelGenerations.delete(uri)
        matchedPositionsCache.delete(uri)
      }
    }

    for (const [uri, model] of activeModelsByUri) {
      if (!modelGenerations.has(uri))
        modelGenerations.set(uri, { model })
    }

    return activeModelsByUri
  }

  async function getMatchedPositionsForDocument(
    document: TextDocumentType,
    modelGeneration: ModelGeneration,
  ): Promise<MatchedPosition[] | undefined> {
    const uno = await getGenerator()
    if (!uno)
      return undefined

    const code = document.getText()
    const contentFingerprint = getContentFingerprint(code)
    const cached = matchedPositionsCache.get(document.uri)
    if (
      cached?.modelGeneration === modelGeneration
      && cached.version === document.version
      && cached.contentFingerprint === contentFingerprint
      && cached.languageId === document.languageId
    ) {
      return cached.positions
    }

    const entryToken = Symbol('matched-positions-cache-entry')
    const positions = computeMatchedPositions(uno, document).catch(() => {
      if (matchedPositionsCache.get(document.uri)?.entryToken === entryToken)
        matchedPositionsCache.delete(document.uri)

      return undefined
    })

    const entry: MatchedPositionsCacheEntry = {
      contentFingerprint,
      entryToken,
      languageId: document.languageId,
      modelGeneration,
      positions,
      version: document.version,
    }
    if (modelGenerations.get(document.uri) === modelGeneration)
      matchedPositionsCache.set(document.uri, entry)

    return positions
  }

  return {
    getGenerator,
    getGeneratorResult,
    resolveDocument(uri, languageId) {
      const activeModels = reconcileModelGenerations(getMirrorModels())
      const model = activeModels.get(uri)
      const modelGeneration = modelGenerations.get(uri)

      if (!model || !modelGeneration)
        return undefined

      const document = TextDocument.create(uri, languageId, model.version, model.getValue())
      let matchedPositions: Promise<MatchedPosition[] | undefined> | undefined

      return {
        document,
        getAutocomplete,
        getGenerator,
        getMatchedPositions: () =>
          matchedPositions ??= getMatchedPositionsForDocument(document, modelGeneration),
      }
    },
  }
}
