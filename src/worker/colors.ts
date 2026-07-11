import type { ColorInformation } from 'vscode-languageserver-protocol'
import type { DocumentSession } from './document-session'
import { getColorString, parseColorToRGBA } from '../vendor/color'
import { getCSS } from '../vendor/css'

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

  const isAttributify = uno.config.presets.some(i => i.name === '@unocss/preset-attributify')
  const isWind4 = uno.config.presets.some(i => i.name === '@unocss/preset-wind4')
  const colors: ColorInformation[] = []
  let firstFailure: unknown

  for (const [start, end, className] of positions) {
    try {
      const css = await getCSS(uno, isAttributify ? [className, `[${className}=""]`] : className, isWind4)
      const colorString = getColorString(css)
      const color = colorString ? parseColorToRGBA(colorString) : undefined
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
    catch (error) {
      firstFailure ??= error
    }
  }

  if (firstFailure) {
    console.warn('monaco-unocss skipped one or more document colors after extraction failed', firstFailure)
    if (colors.length === 0)
      return undefined
  }

  return colors
}
