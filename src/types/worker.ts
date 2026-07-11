import type {
  CompletionContext,
  CompletionItem,
  CompletionList,
  Hover,
  Position,
} from 'vscode-languageserver-protocol'

export interface UnocssWorker {
  doComplete: (
    uri: string,
    languageId: string,
    position: Position,
    context: CompletionContext,
  ) => Promise<CompletionList | undefined>

  doHover: (uri: string, languageId: string, position: Position) => Promise<Hover | undefined> | undefined

  generateStylesFromContent: (css: string, content: any[]) => string

  getDocumentColors: (uri: string, languageId: string) => any

  resolveCompletionItem: (item: CompletionItem) => Promise<CompletionItem | undefined>
}
