import type { UnocssAutocomplete } from '@unocss/autocomplete'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { CompletionItemKind, type CompletionList, type Position, Range } from 'vscode-languageserver-protocol'

export async function doComplete(document: TextDocument, position: Position, autocomplete: UnocssAutocomplete): Promise<CompletionList | undefined> {
  const content = document?.getText()
  const cursor = document?.offsetAt(position)

  if (!content || cursor === undefined) {
    return undefined
  }

  const result = await autocomplete.suggestInFile(content, cursor)

  if (result == null)
    return undefined

  return {
    isIncomplete: false,
    items: result.suggestions.map((s, i) => {
      const resolved = result.resolveReplacement(s[0])
      return {
        label: s[0],
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
