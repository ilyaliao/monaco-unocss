import type { SourceCodeTransformer } from '@unocss/core'
// @env node
import { presetWind3 } from 'unocss'
import { describe, expect, it } from 'vitest'
import { createDocumentSessionFactory } from '../src/worker/document-session'
import { generateStylesFromContent } from '../src/worker/generate-styles'

function replaceCurrentText(
  name: string,
  search: string,
  replacement: string,
): SourceCodeTransformer {
  return {
    name,
    transform(code) {
      const current = code.toString()
      const start = current.indexOf(search)

      if (start < 0)
        throw new Error(`Missing transformer input: ${search}`)

      code.overwrite(start, start + search.length, replacement)
    },
  }
}

describe('generateStylesFromContent transformers', () => {
  it('gives each transformer current offsets after an earlier length change', async () => {
    const factory = createDocumentSessionFactory(
      () => [],
      {
        presets: [presetWind3()],
        transformers: [
          replaceCurrentText('expand-prefix', 'short', 'a-much-longer-prefix'),
          replaceCurrentText('replace-utility', 'pending', 'mt-2'),
        ],
      },
    )

    const css = await generateStylesFromContent(
      factory,
      [{ content: '<div data-state="short" class="pending"></div>' }],
      { preflights: false, safelist: false },
    )

    expect(css).toContain('.mt-2')
    expect(css).toContain('margin-top:0.5rem')
  })

  it('runs transformers in pre, default, post order', async () => {
    const transitions = [
      { enforce: 'post', from: 'c', name: 'post', to: 'mt-2' },
      { enforce: 'default', from: 'b', name: 'default', to: 'c' },
      { enforce: 'pre', from: 'a', name: 'pre', to: 'b' },
    ] as const
    const factory = createDocumentSessionFactory(
      () => [],
      {
        presets: [presetWind3()],
        transformers: transitions.map(transition => ({
          enforce: transition.enforce,
          name: transition.name,
          transform(code) {
            const current = code.toString()
            if (current !== transition.from)
              throw new Error(`${transition.name} received ${current}`)
            code.overwrite(0, current.length, transition.to)
          },
        })),
      },
    )

    const css = await generateStylesFromContent(
      factory,
      [{ content: 'a' }],
      { preflights: false, safelist: false },
    )

    expect(css).toContain('.mt-2')
  })

  it('does not exclude directive transformers from style generation', async () => {
    const factory = createDocumentSessionFactory(
      () => [],
      {
        presets: [presetWind3()],
        transformers: [replaceCurrentText(
          '@unocss/transformer-directives',
          'pending',
          'mt-2',
        )],
      },
    )

    const css = await generateStylesFromContent(
      factory,
      [{ content: 'pending' }],
      { preflights: false, safelist: false },
    )

    expect(css).toContain('.mt-2')
  })

  it('ignores content containing @unocss-ignore', async () => {
    const factory = createDocumentSessionFactory(
      () => [],
      {
        presets: [presetWind3()],
        transformers: [{
          name: 'must-not-run',
          transform() {
            throw new Error('ignored content reached a transformer')
          },
        }],
      },
    )

    await expect(generateStylesFromContent(
      factory,
      [{ content: '<!-- @unocss-ignore --><div class="mt-2"></div>' }],
      { preflights: false, safelist: false },
    )).resolves.toBe('')
  })

  it('masks and excludes @unocss-skip regions', async () => {
    const factory = createDocumentSessionFactory(
      () => [],
      {
        presets: [presetWind3()],
        transformers: [{
          name: 'assert-skip-mask',
          transform(code) {
            if (code.toString().includes('mt-2'))
              throw new Error('skipped content reached a transformer')
          },
        }],
      },
    )
    const source = [
      '<div class="mb-4"></div>',
      '<!-- @unocss-skip-start -->',
      '<div class="mt-2"></div>',
      '<!-- @unocss-skip-end -->',
    ].join('\n')

    const css = await generateStylesFromContent(
      factory,
      [{ content: source }],
      { preflights: false, safelist: false },
    )

    expect(css).toContain('.mb-4')
    expect(css).not.toContain('.mt-2')
  })

  it('does not join tokens around an excluded skip region', async () => {
    const factory = createDocumentSessionFactory(
      () => [],
      {
        rules: [['foobar', { color: 'red' }]],
      },
    )
    const source = [
      'foo',
      '/* @unocss-skip-start */ ignored /* @unocss-skip-end */',
      'bar',
    ].join('')

    await expect(generateStylesFromContent(
      factory,
      [{ content: source }],
      { preflights: false, safelist: false },
    )).resolves.toBe('')
  })

  it('uses one stable transformer id with an optional content extension', async () => {
    const ids: string[] = []
    const factory = createDocumentSessionFactory(
      () => [],
      {
        presets: [presetWind3()],
        transformers: [{
          name: 'capture-id',
          transform(_code, id) {
            ids.push(id)
          },
        }],
      },
    )

    await generateStylesFromContent(
      factory,
      [
        { content: '<div class="mt-2"></div>' },
        { content: '<div class="mb-4"></div>', extension: '.vue' },
      ],
      { preflights: false, safelist: false },
    )

    expect(ids).toEqual([
      'monaco-unocss-content',
      'monaco-unocss-content.vue',
    ])
  })

  it('shares accumulated modules across every content entry in one generation', async () => {
    const moduleSizes: number[] = []
    const modules: Array<Array<[string, string]>> = []
    const factory = createDocumentSessionFactory(
      () => [],
      {
        transformers: [{
          name: 'observe-batch-modules',
          async transform(code, id, context) {
            await context.extract(code.toString(), id)
            moduleSizes.push(context.modules.size)
            modules.push([...context.modules])
          },
        }],
      },
    )

    await generateStylesFromContent(
      factory,
      [
        { content: 'first-content', extension: '.html' },
        { content: 'second-content', extension: '.vue' },
      ],
      { preflights: false, safelist: false },
    )

    expect(moduleSizes).toEqual([1, 2])
    expect(modules.at(-1)).toEqual([
      ['monaco-unocss-content.html', 'first-content'],
      ['monaco-unocss-content.vue', 'second-content'],
    ])
  })

  it('flushes delayed transformer tasks before generating from collected tokens', async () => {
    const factory = createDocumentSessionFactory(
      () => [],
      {
        rules: [['delayed-token', { color: 'red' }]],
        transformers: [{
          name: 'delayed-extraction',
          transform(_code, _id, context) {
            context.tasks.push(new Promise<void>((resolve) => {
              setTimeout(() => {
                context.tokens.add('delayed-token')
                resolve()
              }, 0)
            }))
          },
        }],
      },
    )

    const css = await generateStylesFromContent(
      factory,
      [{ content: '' }],
      { preflights: false, safelist: false },
    )

    expect(css).toContain('.delayed-token')
  })
})
