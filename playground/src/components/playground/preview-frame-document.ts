export interface PreviewFrameLike {
  readonly contentDocument: Document | null
  srcdoc: string
}

function isSrcdocHtmlDocument(document: Document | null): document is Document {
  return document?.URL === 'about:srcdoc'
    && document.contentType === 'text/html'
    && document.documentElement?.localName === 'html'
    && document.head != null
}

export function createPreviewDocumentAccessor(): (
  frame: PreviewFrameLike,
  recoverySrcdoc: string,
) => Document | undefined {
  let activeFrame: PreviewFrameLike | undefined
  let morphableDocument: Document | undefined
  let recoveringFrame: PreviewFrameLike | undefined
  let recoverySourceDocument: Document | null = null

  return (frame, recoverySrcdoc) => {
    if (activeFrame !== frame) {
      activeFrame = frame
      morphableDocument = undefined
      recoveringFrame = undefined
      recoverySourceDocument = null
    }

    let previewDocument: Document | null = null

    try {
      previewDocument = frame.contentDocument
    }
    catch {
      // Cross-origin navigations can make the frame document inaccessible.
    }

    if (isSrcdocHtmlDocument(previewDocument)) {
      if (!morphableDocument && recoveringFrame !== frame) {
        morphableDocument = previewDocument
        return previewDocument
      }

      if (previewDocument === morphableDocument && recoveringFrame !== frame)
        return previewDocument

      if (recoveringFrame === frame && previewDocument !== recoverySourceDocument) {
        morphableDocument = previewDocument
        recoveringFrame = undefined
        recoverySourceDocument = null

        return previewDocument
      }
    }

    if (recoveringFrame !== frame) {
      recoveringFrame = frame
      recoverySourceDocument = previewDocument
      frame.srcdoc = recoverySrcdoc
    }
  }
}
