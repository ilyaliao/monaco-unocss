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
  unocssConfig?: UnocssConfig
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

export interface GenerateStylesFromContentOptions {
  preflights?: boolean
  safelist?: boolean
  minify?: boolean
}

export interface MonacoUnocss extends IDisposable {
  /**
   * Update the current UnoCSS configuration.
   *
   * @param unocssConfig
   *   The new UnoCSS configuration.
   */
  setUnocssConfig: (unocssConfig: UnocssConfig) => void

  /**
   * Generate a stylesheet from arbitrary contents using the worker's UnoCSS config.
   *
   * @param contents
   *   Contents to extract utilities from; plain strings are treated as `{ content }`.
   * @param options
   *   Maps onto UnoCSS `GenerateOptions`: `preflights` (default true), `safelist`
   *   (default true), `minify` (default false).
   * @returns
   *   The merged CSS for all extracted utilities, without duplicated rules.
   */
  generateStylesFromContent: (
    contents: (Content | string)[],
    options?: GenerateStylesFromContentOptions,
  ) => Promise<string>
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
  options?: MonacoUnocssOptions,
) => MonacoUnocss

/**
 * This data can be used with the default Monaco CSS support to support UnoCSS directives.
 *
 * It will provide hover information from the UnoCSS documentation, including a link.
 */
// export const unocssData: languages.css.CSSDataV1

export interface UnocssWorkerOptions {
  /**
   * Hook that will run before the UnoCSS config is used.
   *
   * @param unocssConfig
   *   The UnoCSS configuration passed from the main thread.
   * @returns
   *   A valid UnoCSS configuration.
   */
  prepareUnocssConfig?: (unocssConfig?: UnocssConfig) => UserConfig | PromiseLike<UserConfig>
}
