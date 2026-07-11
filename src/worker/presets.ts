import type { UnoGenerator } from '@unocss/core'

export function hasPreset(uno: UnoGenerator, name: string): boolean {
  return uno.config.presets.some(preset => preset.name === name)
}
