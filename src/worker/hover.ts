import type { UnoGenerator } from '@unocss/core'
import type { Hover, Position } from 'vscode-languageserver-protocol'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getMatchedPositionsForDocument } from './matched-positions-cache'
import { generatePrettiedCssMarkdown } from './prettied-css'

export async function doHover(document: TextDocument, position: Position, generator: Promise<UnoGenerator<object>>): Promise<Hover | undefined> {
  const cursor = document.offsetAt(position)

  let uno: UnoGenerator<object>
  try {
    uno = await generator
  }
  catch {
    return undefined
  }

  let positions: Awaited<ReturnType<typeof getMatchedPositionsForDocument>>
  try {
    positions = await getMatchedPositionsForDocument(uno, document)
  }
  catch {
    return undefined
  }

  const matched = positions.find(([start, end]) => cursor >= start && cursor < end)

  if (!matched)
    return undefined

  const [start, end, text] = matched
  const value = await generatePrettiedCssMarkdown(uno, text)

  if (!value)
    return undefined

  return {
    contents: {
      kind: 'markdown',
      value,
    },
    range: {
      start: document.positionAt(start),
      end: document.positionAt(end),
    },
  }
}
