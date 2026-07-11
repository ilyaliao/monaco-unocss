import type { Mock } from 'vitest'
import { vi } from 'vitest'

export class MockCSSStyleSheet {
  cssRules: CSSRule[] = []

  insertRule(rule: string): number {
    this.cssRules.push({ selectorText: rule.split('{')[0] } as unknown as CSSRule)
    return this.cssRules.length - 1
  }
}

export function setupDomGlobals(): void {
  vi.stubGlobal('CSSStyleSheet', MockCSSStyleSheet)
  vi.stubGlobal('document', { adoptedStyleSheets: [] })
}

export function createDisposable(): { dispose: Mock } {
  return { dispose: vi.fn() }
}
