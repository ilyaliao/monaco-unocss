import type { UnoGenerator } from '@unocss/core'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { defaultIdeMatchExclude, defaultIdeMatchInclude } from '../vendor/defaults-ide'
import { getMatchedPositionsFromCode } from '../vendor/match-positions'

export type MatchedPositions = Awaited<ReturnType<typeof getMatchedPositionsFromCode>>

interface CacheEntry {
  contentFingerprint: string
  positions: Promise<MatchedPositions>
  version: number
}

const cache = new Map<string, CacheEntry>()

function getContentFingerprint(code: string): string {
  let hash = 2166136261
  for (let index = 0; index < code.length; index++) {
    hash ^= code.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${code.length}:${hash >>> 0}`
}

export function clearAllMatchedPositionsCache(): void {
  cache.clear()
}

export function pruneMatchedPositionsCache(activeUris: Iterable<string>): void {
  const active = new Set(activeUris)
  for (const uri of cache.keys()) {
    if (!active.has(uri))
      cache.delete(uri)
  }
}

export function getMatchedPositionsForDocument(
  uno: UnoGenerator,
  document: TextDocument,
): Promise<MatchedPositions> {
  const code = document.getText()
  const contentFingerprint = getContentFingerprint(code)
  const cached = cache.get(document.uri)
  if (cached?.version === document.version && cached.contentFingerprint === contentFingerprint)
    return cached.positions

  const positions = getMatchedPositionsFromCode(uno, code, document.uri, {
    includeRegex: defaultIdeMatchInclude,
    excludeRegex: defaultIdeMatchExclude,
  })

  cache.set(document.uri, {
    contentFingerprint,
    positions,
    version: document.version,
  })

  return positions
}
