import type {
  ColorInformation,
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

  doHover: (uri: string, languageId: string, position: Position) => Promise<Hover | undefined>

  generateStylesFromContent: (css: string, content: any[]) => string

  getDocumentColors: (uri: string, languageId: string) => Promise<ColorInformation[] | undefined>

  resolveCompletionItem: (item: CompletionItem) => Promise<CompletionItem | undefined>
}
