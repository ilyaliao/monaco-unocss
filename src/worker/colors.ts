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

  for (const [start, end, className] of positions) {
    try {
      const css = await getCSS(uno, isAttributify ? [className, `[${className}=""]`] : className, isWind4)
      const colorString = getColorString(css)
      if (!colorString)
        continue

      const color = parseColorToRGBA(colorString)
      if (!color)
        continue

      colors.push({
        range: {
          start: document.positionAt(start),
          end: document.positionAt(end),
        },
        color,
      })
    }
    catch {}
  }

  return colors
}
