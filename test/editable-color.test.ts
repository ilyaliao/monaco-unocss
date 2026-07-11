import { describe, expect, it } from 'vitest'
import { parseEditableColorUtility } from '../src/editable-color'

describe('parseEditableColorUtility', () => {
  it.each([
    ['bg-[hotpink]', { color: 'hotpink', isNamedColor: true, prefix: 'bg' }],
    ['hover:border-[HotPink]', { color: 'HotPink', isNamedColor: true, prefix: 'hover:border' }],
    ['bg-[#f88]', { color: '#f88', isNamedColor: false, prefix: 'bg' }],
    ['text-[rgba(1,2,3,.5)]', { color: 'rgba(1,2,3,.5)', isNamedColor: false, prefix: 'text' }],
    ['fill-[hsl(120,50%,50%)]', { color: 'hsl(120,50%,50%)', isNamedColor: false, prefix: 'fill' }],
  ])('parses editable arbitrary color utility %s', (utility, expected) => {
    expect(parseEditableColorUtility(utility)).toEqual(expected)
  })

  it.each([
    'text-red-500',
    'bg-[var(--brand)]',
    'bg-[not-a-color]',
    'bg-[#f88] trailing',
  ])('rejects non-editable utility %s', (utility) => {
    expect(parseEditableColorUtility(utility)).toBeUndefined()
  })
})
