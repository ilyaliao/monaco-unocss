/*
 * Ported from UnoCSS IDE match defaults:
 * https://github.com/unocss/unocss/blob/672200fabdbfb4a8c7d1f30f15acf70c35573a90/virtual-shared/integration/src/defaults-ide.ts
 * License: MIT
 */

import { SKIP_COMMENT_RE } from './constants'

/**
 * Default match includes in getMatchedPositions for IDE
 */
export const defaultIdeMatchInclude: RegExp[] = [
  // String literals
  // eslint-disable-next-line no-control-regex
  /(['"`])[^\x01]*?\1/g,
  // HTML tags
  /<[^/?<>0-9$_!"'](?:"[^"]*"|'[^']*'|[^>])+>/g,
  // CSS directives
  /(@apply|--uno|--at-apply)[^;]*;/g,
]

/**
 * Default match includes in getMatchedPositions for IDE
 */
export const defaultIdeMatchExclude: RegExp[] = [
  SKIP_COMMENT_RE,
]
