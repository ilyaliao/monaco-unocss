import type { UserConfig } from '@unocss/core'
import type { IDisposable, languages, MonacoEditor } from 'monaco-types'

/**
 * A UnoCSS configuration, but without content.
 */
export type UnocssConfig = UserConfig

export interface MonacoUnocssOptions {
  /**
   * @default defaultLanguageSelector
   */
  languageSelector?: languages.LanguageSelector

  /**
   * The UnoCSS configuration to use.
   *
   * This may be either the UnoCSS configuration object, or a string that gets processed in the
   * worker.
   */
  unocssConfig?: UnocssConfig | string
}

/**
 * Contains the content of CSS classes to extract.
 * With optional "extension" key, which might be relevant
 * to properly extract css classed based on the content language.
 */
export interface Content {
  content: string
  extension?: string
}

export interface MonacoUnocss extends IDisposable {
  /**
   * Update the current UnoCSS configuration.
   *
   * @param unocssConfig
   *   The new UnoCSS configuration.
   */
  setUnocssConfig: (unocssConfig: UnocssConfig | string) => void

  /**
   * Generate styles using UnoCSS.
   */
  generateStylesFromContent: (css: string, content: (Content | string)[]) => Promise<string>
}

/**
 * Configure `monaco-unocss`.
 *
 * @param monaco
 *   The `monaco-editor` module.
 * @param options
 *   Options for customizing the `monaco-unocss`.
 */
export type ConfigureMonacoUnocss = (
  monaco: MonacoEditor,
  options?: MonacoUnocssOptions
) => MonacoUnocss

/**
 * This data can be used with the default Monaco CSS support to support UnoCSS directives.
 *
 * It will provider hover information from the Tailwindcss documentation, including a link.
 */
// export const unocssData: languages.css.CSSDataV1

export interface UnocssWorkerOptions {
  /**
   * Hook that will run before the tailwind config is used.
   *
   * @param unocssConfig
   *   The UnoCSS configuration passed from the main thread.
   * @returns
   *   A valid UnoCSS configuration.
   */
  prepareUnocssConfig?: (tailwindConfig?: UnocssConfig | string) => UserConfig | PromiseLike<UserConfig>
}
