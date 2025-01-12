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
  ) => CompletionList | undefined

  doHover: (uri: string, languageId: string, position: Position) => undefined

  doValidate: (uri: string, languageId: string) => undefined

  generateStylesFromContent: (css: string, content: any[]) => string

  getDocumentColors: (uri: string, languageId: string) => undefined

  resolveCompletionItem: (item: CompletionItem) => undefined
}
