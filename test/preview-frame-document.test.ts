import type { PreviewFrameLike } from '../playground/src/components/playground/preview-frame-document'
import { describe, expect, it } from 'vitest'
import { createPreviewDocumentAccessor } from '../playground/src/components/playground/preview-frame-document'

function createFrame(
  readDocument: () => Document | null,
): PreviewFrameLike & { readonly srcdocWrites: readonly string[] } {
  const srcdocWrites: string[] = []

  return {
    get contentDocument() {
      return readDocument()
    },
    get srcdoc() {
      return srcdocWrites.at(-1) ?? ''
    },
    set srcdoc(value: string) {
      srcdocWrites.push(value)
    },
    srcdocWrites,
  }
}

function createDocumentFixture(
  contentType: string,
  rootName: string,
  hasHead = false,
  url = 'about:srcdoc',
): Document {
  return {
    URL: url,
    contentType,
    documentElement: { localName: rootName },
    head: hasHead ? {} : null,
  } as unknown as Document
}

describe('createPreviewDocumentAccessor', () => {
  it('reloads the latest srcdoc once when a navigation makes the document unavailable', () => {
    const recoveredDocument = createDocumentFixture('text/html', 'html', true)
    let currentDocument: Document | null = null
    const frame = createFrame(() => currentDocument)
    const getDocument = createPreviewDocumentAccessor()

    expect(getDocument(frame, '<main>Latest</main>')).toBeUndefined()
    expect(frame.srcdocWrites).toEqual(['<main>Latest</main>'])

    expect(getDocument(frame, '<main>Newer</main>')).toBeUndefined()
    expect(frame.srcdocWrites).toEqual(['<main>Latest</main>'])

    currentDocument = recoveredDocument
    expect(getDocument(frame, '<main>Newer</main>')).toBe(recoveredDocument)

    currentDocument = null
    expect(getDocument(frame, '<main>Newest</main>')).toBeUndefined()
    expect(frame.srcdocWrites).toEqual([
      '<main>Latest</main>',
      '<main>Newest</main>',
    ])
  })

  it('recovers when reading contentDocument throws', () => {
    const frame = createFrame(() => {
      throw new DOMException('Blocked a frame with origin', 'SecurityError')
    })
    const getDocument = createPreviewDocumentAccessor()

    expect(() => getDocument(frame, '<main>Latest</main>')).not.toThrow()
    expect(frame.srcdocWrites).toEqual(['<main>Latest</main>'])
  })

  it('recovers readable SVG and XML documents that cannot be morphed as HTML', () => {
    const fixtures = [
      createDocumentFixture('image/svg+xml', 'svg'),
      createDocumentFixture('application/xml', 'root'),
    ]

    for (const fixture of fixtures) {
      const frame = createFrame(() => fixture)
      const getDocument = createPreviewDocumentAccessor()

      expect(getDocument(frame, '<main>Latest</main>')).toBeUndefined()
      expect(frame.srcdocWrites).toEqual(['<main>Latest</main>'])
    }
  })

  it('recovers a same-origin HTML navigation instead of morphing it', () => {
    const initialDocument = createDocumentFixture('text/html', 'html', true)
    const navigatedDocument = createDocumentFixture(
      'text/html',
      'html',
      true,
      'https://playground.test/other/page.html',
    )
    const recoveredDocument = createDocumentFixture('text/html', 'html', true)
    let currentDocument = initialDocument
    const frame = createFrame(() => currentDocument)
    const getDocument = createPreviewDocumentAccessor()

    expect(getDocument(frame, '<main>Initial</main>')).toBe(initialDocument)

    currentDocument = navigatedDocument
    expect(getDocument(frame, '<main>Latest</main>')).toBeUndefined()
    expect(frame.srcdocWrites).toEqual(['<main>Latest</main>'])
    expect(getDocument(frame, '<main>Newer</main>')).toBeUndefined()
    expect(frame.srcdocWrites).toEqual(['<main>Latest</main>'])

    currentDocument = recoveredDocument
    expect(getDocument(frame, '<main>Newer</main>')).toBe(recoveredDocument)

    currentDocument = navigatedDocument
    expect(getDocument(frame, '<main>Newest</main>')).toBeUndefined()
    expect(frame.srcdocWrites).toEqual([
      '<main>Latest</main>',
      '<main>Newest</main>',
    ])
  })
})
