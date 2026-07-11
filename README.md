# monaco-unocss

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

UnoCSS IntelliSense for the [Monaco editor](https://microsoft.github.io/monaco-editor/).

> [!WARNING]
> This project was built with AI 🤖.

## Features

- Hover generated CSS for utilities
- Complete utilities with `@unocss/autocomplete`
- Preview and edit colors from generated CSS
- Generate CSS for playgrounds and live previews
- Support attributify mode

## Preview

### Completion

<video src="https://github.com/user-attachments/assets/c89d8f10-cb54-49d6-a4d8-f088b4ac249c" controls>
</video>

### Hover

<video src="https://github.com/user-attachments/assets/20b7f1d6-57e8-4446-bd0e-543ce2324b4a" controls>
</video>

## Install

```bash
pnpm add monaco-unocss unocss @unocss/core @unocss/autocomplete
```

## Usage

Register the Monaco worker:

```ts
// main.ts
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker.js?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker.js?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker'
import { configureMonacoUnocss } from 'monaco-unocss'
import UnocssWorker from './unocss.worker?worker'

window.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    switch (label) {
      case 'editorWorkerService':
        return new EditorWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      case 'unocss':
        return new UnocssWorker()
      default:
        throw new Error(`Unknown label ${label}`)
    }
  },
}

configureMonacoUnocss(monaco)
```

Configure UnoCSS in the worker:

```ts
// unocss.worker.ts
import { initialize } from 'monaco-unocss/unocss.worker'
import { presetAttributify } from 'unocss/preset-attributify'
import { presetWind3 } from 'unocss/preset-wind3'

initialize({
  prepareUnocssConfig() {
    return {
      presets: [presetWind3(), presetAttributify()],
    }
  },
})
```

UnoCSS config lives in the worker because presets, rules, and shortcuts can be functions.

To replace a config at runtime, define a source format and interpret it in the worker hook. This
example accepts an `export default` prefix followed by a JSON object. Replace the worker
`initialize()` call above with:

```ts
// unocss.worker.ts
import type { UserConfig } from '@unocss/core'
import { initialize } from 'monaco-unocss/unocss.worker'
import { presetAttributify } from 'unocss/preset-attributify'
import { presetWind3 } from 'unocss/preset-wind3'

const prefix = 'export default '

function parseConfigSource(source: string): UserConfig {
  if (!source.startsWith(prefix))
    throw new TypeError(`Config source must start with ${JSON.stringify(prefix)}`)

  const config: unknown = JSON.parse(source.slice(prefix.length))
  if (!config || typeof config !== 'object' || Array.isArray(config))
    throw new TypeError('Config source must export an object')

  return config
}

initialize({
  prepareUnocssConfig(unocssConfig) {
    const config = typeof unocssConfig === 'string'
      ? parseConfigSource(unocssConfig)
      : unocssConfig ?? {}

    return {
      ...config,
      presets: [presetWind3(), presetAttributify(), ...(config.presets ?? [])],
    }
  },
})
```

Send source in that format through the library API. Replace the earlier
`configureMonacoUnocss(monaco)` call with:

```ts
// main.ts
const integration = configureMonacoUnocss(monaco, {
  unocssConfig: 'export default {"shortcuts":{"btn":"px-4 py-2"}}',
})

await integration.setUnocssConfig(
  'export default {"shortcuts":{"btn":"px-6 py-3"}}',
)
```

`monaco-unocss` passes config strings through unchanged; it does not evaluate them. The
integrator's `prepareUnocssConfig` hook must parse or evaluate the string and return a valid UnoCSS
config object. Without that hook, the worker rejects string configs.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `languageSelector` | `languages.LanguageSelector` | `['css', 'javascript', 'html', 'mdx', 'typescript']` | Languages to register providers for |
| `unocssConfig` | `UserConfig \| string` | `undefined` | Serializable config or source string passed unchanged to `prepareUnocssConfig` |

## Credits

This project is inspired by and partially contains code derived from the following projects:

- [monaco-tailwindcss](https://github.com/remcohaszing/monaco-tailwindcss)
- [unocss/unocss](https://github.com/unocss/unocss)

## License

[MIT](./LICENSE.md) License © 2024-PRESENT [Ilyal](https://github.com/ilyaliao)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/monaco-unocss?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/monaco-unocss
[npm-downloads-src]: https://img.shields.io/npm/dm/monaco-unocss?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/monaco-unocss
[bundle-src]: https://img.shields.io/bundlephobia/minzip/monaco-unocss?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=monaco-unocss
[license-src]: https://img.shields.io/github/license/ilyaliao/monaco-unocss.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/ilyaliao/monaco-unocss/blob/main/LICENSE.md
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/monaco-unocss
