/*
 * Ported from UnoCSS arbitrary-variants extractor:
 * https://github.com/unocss/unocss/blob/672200fabdbfb4a8c7d1f30f15acf70c35573a90/packages-presets/extractor-arbitrary-variants/src/index.ts
 * License: MIT
 */

export const quotedArbitraryValuesRE
  = /(?:[\w&:[\]-]|\[\S{1,64}=\S{1,64}\]){1,64}\[\\?['"]?\S{1,64}?['"]\]\]?[\w:-]{0,64}/g

export const arbitraryPropertyRE
  = /\[(\\\W|[\w-]){1,64}:[^\s:]{0,64}?("\S{1,64}?"|'\S{1,64}?'|`\S{1,64}?`|[^\s:]{1,64}?)[^\s:]{0,64}?\)?\]/g
