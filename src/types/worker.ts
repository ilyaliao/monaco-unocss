import type {
  CodeActionContext,
  CompletionContext,
  CompletionItem,
  CompletionList,
  Position,
  Range,
} from 'vscode-languageserver-protocol'

export interface UnocssWorker {
  doCodeActions: (
    uri: string,
    languageId: string,
    range: Range,
    context: CodeActionContext
  ) => undefined

  doComplete: (
    uri: string,
    languageId: string,
    position: Position,
    context: CompletionContext
  ) => Promise<CompletionList | undefined>

  doHover: (uri: string, languageId: string, position: Position) => any

  doValidate: (uri: string, languageId: string) => any

  generateStylesFromContent: (css: string, content: any[]) => string

  getDocumentColors: (uri: string, languageId: string) => any

  resolveCompletionItem: (item: CompletionItem) => any
}
