interface DocumentRootAttribute {
  name: string
  value: string
}

export interface DocumentElementLike {
  readonly attributes: ArrayLike<DocumentRootAttribute>
  innerHTML: string
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
}

export function syncDocumentElement(
  current: DocumentElementLike,
  next: DocumentElementLike,
): void {
  const nextAttributes = new Map(
    Array.from(next.attributes, ({ name, value }) => [name, value]),
  )

  for (const { name } of Array.from(current.attributes)) {
    if (!nextAttributes.has(name))
      current.removeAttribute(name)
  }

  for (const [name, value] of nextAttributes)
    current.setAttribute(name, value)

  current.innerHTML = next.innerHTML
}
