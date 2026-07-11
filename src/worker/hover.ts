import type { Hover, Position } from 'vscode-languageserver-protocol'
import type { DocumentSession } from './document-session'
import { generatePrettiedCssMarkdown } from './prettied-css'

export async function doHover(session: DocumentSession, position: Position): Promise<Hover | undefined> {
  const { document } = session
  const cursor = document.offsetAt(position)

  const uno = await session.getGenerator()
  if (!uno)
    return undefined

  const positions = await session.getMatchedPositions()
  if (!positions)
    return undefined

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
