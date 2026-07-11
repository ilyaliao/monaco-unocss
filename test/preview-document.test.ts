import type { DocumentElementLike } from '../playground/src/components/playground/sync-document-element'
import { describe, expect, it } from 'vitest'
import { syncDocumentElement } from '../playground/src/components/playground/sync-document-element'

class InMemoryDocumentElement implements DocumentElementLike {
  innerHTML: string
  private readonly attributeValues: Map<string, string>

  constructor(attributes: Record<string, string>, innerHTML: string) {
    this.attributeValues = new Map(Object.entries(attributes))
    this.innerHTML = innerHTML
  }

  get attributes(): readonly { name: string, value: string }[] {
    return Array.from(this.attributeValues, ([name, value]) => ({ name, value }))
  }

  removeAttribute(name: string): void {
    this.attributeValues.delete(name)
  }

  setAttribute(name: string, value: string): void {
    this.attributeValues.set(name, value)
  }

  toObject(): Record<string, string> {
    return Object.fromEntries(this.attributeValues)
  }
}

describe('syncDocumentElement', () => {
  it('replaces the document content and reconciles every root attribute', () => {
    const current = new InMemoryDocumentElement({
      'class': 'old-theme',
      'data-stale': 'true',
      'dir': 'ltr',
      'lang': 'en',
      'style': 'color: red',
    }, '<head><title>Old</title></head><body>Old</body>')
    const next = new InMemoryDocumentElement({
      'class': 'new-theme',
      'data-current': 'true',
      'dir': 'rtl',
      'lang': 'zh-Hant',
      'style': 'color: blue',
    }, '<head><title>New</title></head><body>New</body>')

    syncDocumentElement(current, next)

    expect(current.toObject()).toEqual({
      'class': 'new-theme',
      'data-current': 'true',
      'dir': 'rtl',
      'lang': 'zh-Hant',
      'style': 'color: blue',
    })
    expect(current.innerHTML).toBe('<head><title>New</title></head><body>New</body>')
    expect(next.toObject()).toEqual({
      'class': 'new-theme',
      'data-current': 'true',
      'dir': 'rtl',
      'lang': 'zh-Hant',
      'style': 'color: blue',
    })
  })
})
