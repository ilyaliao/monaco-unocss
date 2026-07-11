import { describe, expect, it } from 'vitest'
import { getColorString, parseColorToRGBA } from '../src/vendor/color'

describe('getColorString', () => {
  it('extracts a hex color declaration', () => {
    expect(getColorString('.sample { color: #ff69b4; }')).toBe('#ff69b4')
  })

  it('skips named-color declarations the color regex does not match', () => {
    const css = '.sample { color: red; border-color: #00f; }'

    expect(getColorString(css)).toBe('#00f')
  })

  it('extracts colors from raw rules with type and pseudo selectors', () => {
    expect(getColorString('a:hover{color:#f00;}')).toBe('#f00')
  })

  it('resolves a CSS variable from its definition', () => {
    const css = ':root { --brand: #00f; } .sample { color: var(--brand); }'

    expect(getColorString(css)).toBe('#00f')
  })

  it('resolves a CSS variable fallback when undefined', () => {
    const css = '.sample { color: rgb(10 20 30 / var(--alpha, 0.5)); }'

    expect(getColorString(css)).toBe('rgb(10 20 30 /  0.5)')
  })
})

describe('parseColorToRGBA', () => {
  it('parses hex colors', () => {
    expect(parseColorToRGBA('#ff69b4')).toEqual({
      red: 1,
      green: 105 / 255,
      blue: 180 / 255,
      alpha: 1,
    })
  })

  it('parses rgb function colors', () => {
    expect(parseColorToRGBA('rgb(255 0 0)')).toEqual({
      red: 1,
      green: 0,
      blue: 0,
      alpha: 1,
    })
  })

  it('returns undefined for unparsable colors', () => {
    expect(parseColorToRGBA('not-a-color')).toBeUndefined()
  })
})
