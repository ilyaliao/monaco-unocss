import type { UnocssAutocomplete } from '@unocss/autocomplete'
import type { UnoGenerator } from '@unocss/core'
import type { CompletionItem, CompletionList, Position } from 'vscode-languageserver-protocol'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { CompletionItemKind, Range } from 'vscode-languageserver-protocol'
import { generatePrettiedCssMarkdown } from './prettied-css'

export async function doComplete(document: TextDocument, position: Position, autocomplete: UnocssAutocomplete): Promise<CompletionList | undefined> {
  const content = document?.getText()
  const cursor = document?.offsetAt(position)

  if (!content || cursor === undefined) {
    return undefined
  }

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
  item: CompletionItem,
  generator: Promise<UnoGenerator<object>>,
): Promise<CompletionItem> {
  const utility = getCompletionItemUtility(item)

  if (!utility)
    return item

  let uno: UnoGenerator<object>
  try {
    uno = await generator
  }
  catch {
    return item
  }

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
