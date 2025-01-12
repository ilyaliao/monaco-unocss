import type { CompletionList } from 'vscode-languageserver-protocol'

export function doComplete(state: any, document: any): CompletionList | undefined {
  // eslint-disable-next-line no-console
  console.log('start complete', document)

  return undefined
  // return parseAutocomplete.suggestInFile(content, cursor)
}
