import { createGenerator } from '@unocss/core'
import { presetWind3 } from 'unocss'
import { expect, it } from 'vitest'
import { generatePrettiedCssMarkdown } from '../src/worker/prettied-css'

it('preserves escaped structural punctuation in generated selectors', async () => {
  const uno = await createGenerator({
    presets: [presetWind3()],
  })

  const markdown = await generatePrettiedCssMarkdown(
    uno,
    'content-["/*x;{y}*/"]',
  )

  expect(markdown?.split('\n')).toEqual([
    '```css',
    '/* layer: default */',
    expect.stringMatching(/^\.content-.+ \{$/),
    '  content: "/*x;{y}*/";',
    '}',
    '```',
  ])
})

it('ignores escaped colons when locating declaration separators', async () => {
  const uno = await createGenerator({
    rules: [['escaped-property', { '--foo\\:bar': 'value' }]],
  })

  const markdown = await generatePrettiedCssMarkdown(uno, 'escaped-property')

  expect(markdown?.split('\n')).toContain('  --foo\\:bar: value;')
})

it('ignores structural punctuation inside block comments', async () => {
  const uno = await createGenerator({
    rules: [[/^commented$/, () => '.commented{/* comment;{} */color:red;}']],
  })

  const markdown = await generatePrettiedCssMarkdown(uno, 'commented')

  expect(markdown?.split('\n')).toEqual([
    '```css',
    '/* layer: default */',
    '.commented {',
    '  /* comment;{} */',
    '  color: red;',
    '}',
    '```',
  ])
})

it('returns no markdown when the formatter rejects the generated CSS', async () => {
  const uno = await createGenerator({
    rules: [['simple-blocks', { '--curly': '{a;b}', '--square': '[c;d]' }]],
  })

  const markdown = await generatePrettiedCssMarkdown(uno, 'simple-blocks')

  expect(markdown).toBeUndefined()
})

it('wraps generated CSS in a fixed css fence', async () => {
  const uno = await createGenerator({
    rules: [[/^backticks$/, () => '.backticks{--short:```;--long:`````;}']],
  })

  const markdown = await generatePrettiedCssMarkdown(uno, 'backticks')
  const lines = markdown?.split('\n')

  expect(lines?.[0]).toBe('```css')
  expect(lines?.at(-1)).toBe('```')
})
