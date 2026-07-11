import type { CompletionItem, CompletionList, Position } from 'vscode-languageserver-protocol'
import type { DocumentSession, DocumentSessionFactory } from './document-session'
import { CompletionItemKind, Range } from 'vscode-languageserver-protocol'
import { generatePrettiedCssMarkdown } from './prettied-css'

export async function doComplete(session: DocumentSession, position: Position): Promise<CompletionList | undefined> {
  const { document } = session
  const content = document.getText()
  const cursor = document.offsetAt(position)

  if (!content || cursor === undefined) {
    return undefined
  }

  const autocomplete = await session.getAutocomplete()
  if (!autocomplete)
    return undefined

  const result = await autocomplete.suggestInFile(content, cursor)

  if (!result?.suggestions?.length)
    return undefined

  return {
    isIncomplete: false,
    items: result.suggestions.map(([value, label]) => {
      const resolved = result.resolveReplacement(value)
      return {
        label,
        kind: CompletionItemKind.Constant,
        data: { value },
        textEdit: {
          newText: resolved.replacement,
          range: Range.create(
            document.positionAt(resolved.start),
            document.positionAt(resolved.end),
          ),
        },
      }
    }),
  }
}

function getCompletionItemUtility(item: CompletionItem): string | undefined {
  const data = item.data as { value?: unknown } | undefined

  if (typeof data?.value === 'string')
    return data.value

  if (typeof item.label === 'string')
    return item.label
}

export async function resolveCompletionItem(
  factory: DocumentSessionFactory,
  item: CompletionItem,
): Promise<CompletionItem> {
  const utility = getCompletionItemUtility(item)

  if (!utility)
    return item

  const uno = await factory.getGenerator()
  if (!uno)
    return item

  const value = await generatePrettiedCssMarkdown(uno, utility)

  if (!value)
    return item

  return {
    ...item,
    documentation: {
      kind: 'markdown',
      value,
    },
  }
}
