import type { UnoGenerator } from '@unocss/core'
import { hasPreset } from './presets'

export function getUtilityCandidates(
  uno: UnoGenerator,
  utility: string,
): string | string[] {
  return hasPreset(uno, '@unocss/preset-attributify')
    ? [utility, `[${utility}=""]`]
    : utility
}
