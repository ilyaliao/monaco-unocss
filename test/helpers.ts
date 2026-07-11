import type { Mock } from 'vitest'
import { vi } from 'vitest'

export class MockCSSStyleSheet {
  cssRules: CSSRule[] = []

  deleteRule(index: number): void {
    this.cssRules.splice(index, 1)
  }

  insertRule(rule: string): number {
    this.cssRules.push({
      cssText: rule,
      selectorText: rule.split('{')[0],
    } as unknown as CSSRule)
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

export function createDeferred<T>(): {
  promise: Promise<T>
  reject: (reason?: unknown) => void
  resolve: (value: T) => void
} {
  let reject!: (reason?: unknown) => void
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise
    resolve = resolvePromise
  })

  return { promise, reject, resolve }
}

export type PromiseSettlement<T>
  = | { status: 'pending' }
    | { status: 'rejected', reason: unknown }
    | { status: 'resolved', value: T }

export async function settleSoon<T>(promise: Promise<T>): Promise<PromiseSettlement<T>> {
  return await Promise.race([
    promise.then(
      (value): PromiseSettlement<T> => ({ status: 'resolved', value }),
      (reason): PromiseSettlement<T> => ({ status: 'rejected', reason }),
    ),
    new Promise<PromiseSettlement<T>>(resolve => setTimeout(
      resolve,
      0,
      { status: 'pending' },
    )),
  ])
}
