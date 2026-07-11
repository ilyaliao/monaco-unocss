import type { UnoGenerator } from '@unocss/core'
import { getCSS, getPrettiedMarkdown } from '../vendor/css'
import { getUtilityCandidates } from './utility-candidates'

const remToPxRatio = 16

export async function generatePrettiedCssMarkdown(
  uno: UnoGenerator,
  utility: string,
): Promise<string | undefined> {
  const candidates = getUtilityCandidates(uno, utility)

  try {
    const css = await getCSS(uno, candidates)

    if (!css.trim())
      return undefined

    return await getPrettiedMarkdown(uno, candidates, remToPxRatio)
  }
  catch {
    return undefined
  }
}
