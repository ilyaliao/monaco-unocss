// @env browser
import type { editor, IDisposable, languages, MonacoEditor, Uri } from 'monaco-types'
import type { CompletionItem as LspCompletionItem } from 'vscode-languageserver-protocol'

import type { UnocssWorker } from './types/worker'
import { fromRatio, names as namedColors } from '@ctrl/tinycolor'
import {
  fromCompletionContext,
  fromCompletionItem,
  fromPosition,
  toColorInformation,
  toCompletionItem,
  toCompletionList,
  toHover,
} from 'monaco-languageserver-types'
import { decidePreserveOrClear } from './preserve-or-clear'

type WorkerAccessor = (...args: Uri[]) => Promise<UnocssWorker>
type CompletionItemWithData = languages.CompletionItem & { data?: unknown }

interface ModelLayerRequest<T> {
  canCommit: () => boolean
  clearLastKnownGood: () => void
  getLastKnownGood: () => T | undefined
  setLastKnownGood: (value: T) => void
}

interface ModelLayerState<T> {
  begin: (model: editor.ITextModel) => ModelLayerRequest<T>
  reset: (model: editor.ITextModel) => void
}

const colorNames = Object.keys(namedColors)
const editableColorRegex = new RegExp(
  `-\\[(${colorNames.join('|')}|(?:(?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`,
  'i',
)
const sheet = new CSSStyleSheet()
document.adoptedStyleSheets.push(sheet)

function createModelLayerState<T>(): ModelLayerState<T> {
  const lastKnownGood = new WeakMap<editor.ITextModel, T>()
  const latestRequests = new WeakMap<editor.ITextModel, symbol>()

  return {
    begin(model) {
      const versionId = model.getVersionId()
      const languageId = model.getLanguageId()
      const request = Symbol('model-layer-request')
      latestRequests.set(model, request)

      return {
        canCommit: () =>
          !model.isDisposed()
          && versionId === model.getVersionId()
          && languageId === model.getLanguageId()
          && latestRequests.get(model) === request,
        clearLastKnownGood: () => lastKnownGood.delete(model),
        getLastKnownGood: () => lastKnownGood.get(model),
        setLastKnownGood: value => lastKnownGood.set(model, value),
      }
    },
    reset(model) {
      lastKnownGood.delete(model)
      latestRequests.delete(model)
    },
  }
}

function colorValueToHex(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, '0')
}

function createColorClass(color: languages.IColor): string {
  const hex = `${colorValueToHex(color.red)}${colorValueToHex(color.green)}${colorValueToHex(
    color.blue,
  )}`
  const className = `unocss-color-decoration-${hex}`
  const selector = `.${className}`
  for (const rule of Array.from(sheet.cssRules)) {
    if ((rule as CSSStyleRule).selectorText === selector) {
      return className
    }
  }
  sheet.insertRule(`${selector}{background-color:#${hex}}`)
  return className
}

function copyCompletionItemData(target: languages.CompletionItem, source: { data?: unknown }): void {
  if (source.data === undefined)
    return

  const targetWithData = target as CompletionItemWithData
  targetWithData.data = source.data
}

function fromCompletionItemWithData(item: languages.CompletionItem): LspCompletionItem {
  const result = fromCompletionItem(item)
  const data = (item as CompletionItemWithData).data

  if (data !== undefined)
    result.data = data

  return result
}

export function createColorProvider(
  monaco: MonacoEditor,
  getWorker: WorkerAccessor,
): languages.DocumentColorProvider & IDisposable {
  const modelMap = new WeakMap<editor.ITextModel, string[]>()
  const layerState = createModelLayerState<languages.IColorInformation[]>()
  const models = new Set<editor.ITextModel>()
  let disposed = false
  const clearModel = (model: editor.ITextModel): void => {
    if (!model.isDisposed())
      model.deltaDecorations(modelMap.get(model) ?? [], [])
    modelMap.delete(model)
    layerState.reset(model)
    models.delete(model)
  }
  const modelDisposeListener = monaco.editor.onWillDisposeModel((model) => {
    modelMap.delete(model)
    layerState.reset(model)
    models.delete(model)
  })
  const modelLanguageListener = monaco.editor.onDidChangeModelLanguage(({ model }) => {
    clearModel(model)
  })

  return {
    dispose() {
      if (disposed)
        return

      disposed = true
      modelDisposeListener.dispose()
      modelLanguageListener.dispose()
      for (const model of [...models])
        clearModel(model)
    },

    async provideDocumentColors(model) {
      if (disposed)
        return

      models.add(model)
      const request = layerState.begin(model)
      const worker = await getWorker(model.uri)

      const result = await worker.getDocumentColors(String(model.uri), model.getLanguageId())
      if (!request.canCommit())
        return request.getLastKnownGood()

      const decision = decidePreserveOrClear(result)

      if (decision.kind === 'preserve')
        return request.getLastKnownGood()

      const editableColors: languages.IColorInformation[] = []
      const nonEditableColors: editor.IModelDeltaDecoration[] = []
      if (decision.kind === 'set') {
        for (const lsColor of decision.items) {
          const monacoColor = toColorInformation(lsColor)
          const text = model.getValueInRange(monacoColor.range)
          if (editableColorRegex.test(text)) {
            editableColors.push(monacoColor)
          }
          else {
            nonEditableColors.push({
              range: monacoColor.range,
              options: {
                before: {
                  content: '\u00A0',
                  inlineClassName: `${createColorClass(monacoColor.color)} colorpicker-color-decoration`,
                  inlineClassNameAffectsLetterSpacing: true,
                },
              },
            })
          }
        }
      }

      modelMap.set(model, model.deltaDecorations(modelMap.get(model) ?? [], nonEditableColors))
      request.setLastKnownGood(editableColors)

      return editableColors
    },

    provideColorPresentations(model, colorInformation) {
      const className = model.getValueInRange(colorInformation.range)
      const match = editableColorRegex.exec(className)

      if (!match) {
        return []
      }

      const [, currentColor] = match

      const isNamedColor = colorNames.includes(currentColor.toLowerCase())
      const color = fromRatio({
        r: colorInformation.color.red,
        g: colorInformation.color.green,
        b: colorInformation.color.blue,
        a: colorInformation.color.alpha,
      })

      let hexValue = color.toHex8String(
        !isNamedColor && (currentColor.length === 4 || currentColor.length === 5),
      )
      if (hexValue.length === 5) {
        hexValue = hexValue.replace(/f$/, '')
      }
      else if (hexValue.length === 9) {
        hexValue = hexValue.replace(/ff$/, '')
      }

      const rgbValue = color.toRgbString().replaceAll(' ', '')
      const hslValue = color.toHslString().replaceAll(' ', '')
      const prefix = className.slice(0, Math.max(0, match.index))

      return [
        { label: `${prefix}-[${hexValue}]` },
        { label: `${prefix}-[${rgbValue}]` },
        { label: `${prefix}-[${hslValue}]` },
      ]
    },
  }
}

export function createHoverProvider(getWorker: WorkerAccessor): languages.HoverProvider {
  return {
    async provideHover(model, position) {
      const worker = await getWorker(model.uri)

      const hover = await worker.doHover(
        String(model.uri),
        model.getLanguageId(),
        fromPosition(position),
      )

      return hover && toHover(hover)
    },
  }
}

export function createCompletionItemProvider(
  getWorker: WorkerAccessor,
): languages.CompletionItemProvider {
  return {
    async provideCompletionItems(model, position, context) {
      const worker = await getWorker(model.uri)

      const completionList = await worker.doComplete(
        String(model.uri),
        model.getLanguageId(),
        fromPosition(position),
        fromCompletionContext(context),
      )

      if (!completionList) {
        return
      }

      const wordInfo = model.getWordUntilPosition(position)

      const result = toCompletionList(completionList, {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: wordInfo.endColumn,
        },
      })

      for (const [index, item] of result.suggestions.entries()) {
        const sourceItem = completionList.items[index]

        if (sourceItem)
          copyCompletionItemData(item, sourceItem)
      }

      return result
    },

    async resolveCompletionItem(item) {
      const worker = await getWorker()

      const result = await worker.resolveCompletionItem(fromCompletionItemWithData(item))

      if (!result) {
        return item
      }

      const resolved = toCompletionItem(result, { range: item.range })
      copyCompletionItemData(resolved, result)

      return resolved
    },
  }
}
