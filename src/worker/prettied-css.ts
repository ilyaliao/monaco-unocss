import type { UnoGenerator } from '@unocss/core'
import parserPostcss from 'prettier/plugins/postcss'
import { format } from 'prettier/standalone'
import { getCSS } from '../vendor/css'

async function formatCssAsMarkdown(css: string): Promise<string> {
  const formattedCss = (await format(css, {
    parser: 'css',
    plugins: [parserPostcss],
  })).trimEnd()

  return `\`\`\`css\n${formattedCss}\n\`\`\``
}

export async function generatePrettiedCssMarkdown(
  uno: UnoGenerator,
  utility: string,
): Promise<string | undefined> {
  const isAttributify = uno.config.presets.some(p => p.name === '@unocss/preset-attributify')

  try {
    const css = await getCSS(uno, isAttributify ? [utility, `[${utility}=""]`] : utility)

    if (!css.trim())
      return undefined

    return await formatCssAsMarkdown(css)
  }
  catch {
    return undefined
  }
}
