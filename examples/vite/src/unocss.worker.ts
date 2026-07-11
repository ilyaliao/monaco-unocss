// @env worker
import transformerVariantGroup from '@unocss/transformer-variant-group'
import { initialize } from 'monaco-unocss/unocss.worker'
import { presetAttributify } from 'unocss/preset-attributify'
import { presetIcons } from 'unocss/preset-icons'
import { presetTypography } from 'unocss/preset-typography'
import { presetWebFonts } from 'unocss/preset-web-fonts'
import { presetWind3 } from 'unocss/preset-wind3'

initialize({
  prepareUnocssConfig(unocssConfig) {
    return {
      shortcuts: [
        {
          'color-base': 'dark:text-#ffffff text-#222222',

          'scroll-bar': 'scrollbar-thumb-color-[#808080] scrollbar-track-color-transparent scrollbar-thumb-radius-4 scrollbar-track-radius-4',

          'bg-line': 'bg-[linear-gradient(90deg,#ffffff_0%,transparent_85.49%)]',

          // ref: https://github.com/unocss/unocss/issues/2614
          'break-anywhere': '[@supports(overflow-wrap:anywhere)]:[overflow-wrap:anywhere] [@supports(overflow-wrap:anywhere)]:[word-break:normal]',
        },
      ],
      presets: [
        presetWind3(),
        presetAttributify(),
        presetTypography(),
        presetIcons({
          scale: 1.2,
          warn: true,
        }),
        presetWebFonts({
          fonts: {
            roboto: 'Roboto',
          },
        }),
      ],
      transformers: [
        transformerVariantGroup(),
      ],
      ...unocssConfig,
    }
  },
})
