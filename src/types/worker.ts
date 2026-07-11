import type {
  CodeAction,
  CodeActionContext,
  ColorInformation,
  CompletionContext,
  CompletionItem,
  CompletionList,
  Hover,
  Position,
  Range,
} from 'vscode-languageserver-protocol'
import type { Content, GenerateStylesFromContentOptions } from './configure'

export interface UnocssWorker {
  doComplete: (
    uri: string,
    languageId: string,
    position: Position,
    context: CompletionContext,
  ) => Promise<CompletionList | undefined>

  doHover: (uri: string, languageId: string, position: Position) => Promise<Hover | undefined>

  generateStylesFromContent: (
    contents: (Content | string)[],
    options?: GenerateStylesFromContentOptions,
  ) => Promise<string>

  getDocumentColors: (uri: string, languageId: string) => Promise<ColorInformation[] | undefined>

  resolveCompletionItem: (item: CompletionItem) => Promise<CompletionItem | undefined>
}
