import type { ConfigureMonacoUnocss } from './types'

export const defaultLanguageSelector = ['css', 'javascript', 'html', 'mdx', 'typescript'] as const

export const configureMonacoUnocss: ConfigureMonacoUnocss
  = (_monaco, { languageSelector = defaultLanguageSelector, unocssConfig } = {}) => {
    // eslint-disable-next-line no-console
    console.log('test', languageSelector, unocssConfig)

    return {
      dispose: () => {},

      setUnocssConfig: (_unocssConfig: any) => {},

      generateStylesFromContent: async (_css: string, _content: any): Promise<string> => {
        return ''
      },
    }
  }
