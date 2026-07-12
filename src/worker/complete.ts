import type { UnocssAutocomplete } from '@unocss/autocomplete'
import type { CompletionList, Position } from 'vscode-languageserver-protocol'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { CompletionItemKind, Range } from 'vscode-languageserver-protocol'

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
    items: result.suggestions.map(([value, label], i) => {
      const resolved = result.resolveReplacement(value)
      return {
        label,
        kind: CompletionItemKind.Constant,
        data: i,
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
