// @env worker
import { icons as carbonIcons } from '@iconify-json/carbon'
import transformerVariantGroup from '@unocss/transformer-variant-group'
import { initialize } from 'monaco-unocss/unocss.worker'
import { presetAttributify } from 'unocss/preset-attributify'
import { presetIcons } from 'unocss/preset-icons'
import { presetTypography } from 'unocss/preset-typography'
import { presetWind3 } from 'unocss/preset-wind3'

initialize({
  prepareUnocssConfig(unocssConfig) {
    return {
      presets: [
        presetWind3(),
        presetAttributify(),
        presetTypography(),
        presetIcons({
          collections: {
            carbon: () => carbonIcons,
          },
          scale: 1.2,
          warn: true,
        }),
      ],
      transformers: [
        transformerVariantGroup(),
      ],
      ...(typeof unocssConfig === 'object' ? unocssConfig : {}),
    }
  },
})
