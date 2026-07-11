import type { ColorInformation } from 'vscode-languageserver-protocol'
import type { DocumentSession } from './document-session'
import { getColorString, parseColorToRGBA } from '../vendor/color'
import { getCSS } from '../vendor/css'
import { hasPreset } from './presets'
import { getUtilityCandidates } from './utility-candidates'

export async function getDocumentColors(
  session: DocumentSession,
): Promise<ColorInformation[] | undefined> {
  const { document } = session
  const uno = await session.getGenerator()
  if (!uno)
    return undefined

  const positions = await session.getMatchedPositions()
  if (!positions)
    return undefined

  const isWind4 = hasPreset(uno, '@unocss/preset-wind4')
  const colors: ColorInformation[] = []
  const parsedColors = new Map<string, ColorInformation['color'] | undefined>()
  let firstFailure: unknown

  for (const [start, end, className] of positions) {
    if (!parsedColors.has(className)) {
      try {
        const css = await getCSS(uno, getUtilityCandidates(uno, className), isWind4)
        const colorString = getColorString(css)
        parsedColors.set(className, colorString ? parseColorToRGBA(colorString) : undefined)
      }
      catch (error) {
        parsedColors.set(className, undefined)
        firstFailure ??= error
      }
    }

    const color = parsedColors.get(className)
    if (color) {
      colors.push({
        range: {
          start: document.positionAt(start),
          end: document.positionAt(end),
        },
        color,
      })
    }
  }

  if (firstFailure) {
    console.warn('monaco-unocss skipped one or more document colors after extraction failed', firstFailure)
    if (colors.length === 0)
      return undefined
  }

  return colors
}
