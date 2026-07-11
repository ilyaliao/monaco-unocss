import { names as namedColors } from '@ctrl/tinycolor'

export interface EditableColorUtility {
  color: string
  isNamedColor: boolean
  prefix: string
}

const namedColorNames = Object.keys(namedColors)
const namedColorSet = new Set(namedColorNames)
const editableColorPattern = new RegExp(
  `-\\[(${namedColorNames.join('|')}|(?:(?:#|rgba?\\(|hsla?\\()[^\\]]+))\\]$`,
  'i',
)

export function parseEditableColorUtility(value: string): EditableColorUtility | undefined {
  const match = editableColorPattern.exec(value)

  if (!match?.[1])
    return

  const color = match[1]

  return {
    color,
    isNamedColor: namedColorSet.has(color.toLowerCase()),
    prefix: value.slice(0, match.index),
  }
}
