import type { UnoGenerator } from '@unocss/core'
import type { ColorInformation } from 'vscode-languageserver-protocol'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getColorString, parseColorToRGBA } from '../vendor/color'
import { getCSS } from '../vendor/css'
import { getMatchedPositionsForDocument } from './matched-positions-cache'

export async function getDocumentColors(
  document: TextDocument,
  generator: Promise<UnoGenerator<object>>,
): Promise<ColorInformation[] | undefined> {
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
