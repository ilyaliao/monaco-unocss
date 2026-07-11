import type {
  ColorInformation,
  CompletionContext,
  CompletionItem,
  CompletionList,
  Hover,
  Position,
} from 'vscode-languageserver-protocol'
import type { Content, GenerateStylesFromContentOptions } from './configure'

export type WorkerFeatureResult<T>
  = | { ok: true, value: T[] }
    | { ok: false }

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

  getDocumentColors: (
    uri: string,
    languageId: string,
  ) => Promise<WorkerFeatureResult<ColorInformation> | undefined>

  resolveCompletionItem: (item: CompletionItem) => Promise<CompletionItem | undefined>
}
