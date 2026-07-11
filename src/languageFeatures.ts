// @env browser
import type { editor, IDisposable, languages, MonacoEditor, Uri } from 'monaco-types'
import type { CompletionItem as LspCompletionItem } from 'vscode-languageserver-protocol'

import type { UnocssWorker } from './types/worker'
import { fromRatio } from '@ctrl/tinycolor'
import {
  fromCompletionContext,
  fromCompletionItem,
  fromPosition,
  toColorInformation,
  toCompletionItem,
  toCompletionList,
  toHover,
} from 'monaco-languageserver-types'
import { parseEditableColorUtility } from './editable-color'
import { decidePreserveOrClear } from './preserve-or-clear'

type WorkerAccessor = (...args: Uri[]) => Promise<UnocssWorker>
type CompletionItemWithData = languages.CompletionItem & { data?: unknown }

interface ModelLayerRequest<T> {
  canCommit: () => boolean
  clearLastKnownGood: () => void
  complete: () => void
  getLastKnownGood: () => T | undefined
  invalidated: Promise<void>
  setLastKnownGood: (value: T) => void
}

interface ModelLayerRequestRecord<T> extends ModelLayerRequest<T> {
  invalidate: () => void
  languageId: string
}

interface ModelLayerState<T> {
  begin: (model: editor.ITextModel) => ModelLayerRequest<T>
  clearLastKnownGood: (model: editor.ITextModel) => void
  invalidate: (model: editor.ITextModel) => void
  invalidateAll: () => void
}

type ModelLayerRequestOutcome<T>
  = | { kind: 'invalidated' }
    | { kind: 'result', value: T }

interface ModelColorDecorationState {
  classNames: Set<string>
  decorationIds: string[]
}

interface ColorProvider extends languages.DocumentColorProvider, IDisposable {
  reset: () => void
}

const colorClassPrefix = 'unocss-color-decoration-'
const colorClassReferences = new Map<string, number>()
const sheet = new CSSStyleSheet()
document.adoptedStyleSheets.push(sheet)

function createModelLayerState<T>(): ModelLayerState<T> {
  let lastKnownGood = new WeakMap<editor.ITextModel, T>()
  let latestRequests = new WeakMap<editor.ITextModel, ModelLayerRequestRecord<T>>()
  const activeRequests = new Set<ModelLayerRequestRecord<T>>()

  return {
    begin(model) {
      latestRequests.get(model)?.invalidate()

      const versionId = model.getVersionId()
      const languageId = model.getLanguageId()
      let invalidated = false
      let resolveInvalidated!: () => void
      const invalidation = new Promise<void>((resolve) => {
        resolveInvalidated = resolve
      })
      const request: ModelLayerRequestRecord<T> = {
        canCommit: () =>
          !invalidated
          && !model.isDisposed()
          && versionId === model.getVersionId()
          && languageId === model.getLanguageId()
          && latestRequests.get(model) === request,
        clearLastKnownGood: () => lastKnownGood.delete(model),
        complete: () => activeRequests.delete(request),
        getLastKnownGood: () => lastKnownGood.get(model),
        invalidate() {
          if (invalidated)
            return

          invalidated = true
          activeRequests.delete(request)
          resolveInvalidated()
        },
        invalidated: invalidation,
        languageId,
        setLastKnownGood: value => lastKnownGood.set(model, value),
      }
      activeRequests.add(request)
      latestRequests.set(model, request)

      return request
    },
    invalidate(model) {
      lastKnownGood.delete(model)
      latestRequests.get(model)?.invalidate()
      latestRequests.delete(model)
    },
    clearLastKnownGood(model) {
      lastKnownGood.delete(model)
      const request = latestRequests.get(model)
      if (request && request.languageId !== model.getLanguageId()) {
        request.invalidate()
        latestRequests.delete(model)
      }
    },
    invalidateAll() {
      lastKnownGood = new WeakMap()
      latestRequests = new WeakMap()
      for (const request of [...activeRequests])
        request.invalidate()
    },
  }
}

async function raceModelLayerRequest<T>(
  request: Pick<ModelLayerRequest<never>, 'invalidated'>,
  operation: Promise<T>,
): Promise<ModelLayerRequestOutcome<T>> {
  return await Promise.race([
    operation.then((value): ModelLayerRequestOutcome<T> => ({ kind: 'result', value })),
    request.invalidated.then((): ModelLayerRequestOutcome<T> => ({ kind: 'invalidated' })),
  ])
}

function colorValueToHex(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, '0')
}

function createColorClassName(color: languages.IColor): string {
  const hex = [color.red, color.green, color.blue, color.alpha]
    .map(colorValueToHex)
    .join('')
  return `${colorClassPrefix}${hex}`
}

function retainColorClass(className: string): void {
  const referenceCount = colorClassReferences.get(className) ?? 0
  if (referenceCount > 0) {
    colorClassReferences.set(className, referenceCount + 1)
    return
  }

  const selector = `.${className}`
  for (const rule of Array.from(sheet.cssRules)) {
    if ((rule as CSSStyleRule).selectorText === selector) {
      colorClassReferences.set(className, 1)
      return
    }
  }

  const hex = className.slice(colorClassPrefix.length)
  sheet.insertRule(`${selector}{background-color:#${hex}}`)
  colorClassReferences.set(className, 1)
}

function releaseColorClass(className: string): void {
  const referenceCount = colorClassReferences.get(className)
  if (referenceCount === undefined)
    return

  if (referenceCount > 1) {
    colorClassReferences.set(className, referenceCount - 1)
    return
  }

  colorClassReferences.delete(className)
  const selector = `.${className}`
  const ruleIndex = Array.from(sheet.cssRules).findIndex(
    rule => (rule as CSSStyleRule).selectorText === selector,
  )
  if (ruleIndex !== -1)
    sheet.deleteRule(ruleIndex)
}

function releaseColorClasses(classNames: ReadonlySet<string>): void {
  for (const className of classNames)
    releaseColorClass(className)
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
): ColorProvider {
  const modelMap = new WeakMap<editor.ITextModel, ModelColorDecorationState>()
  const layerState = createModelLayerState<languages.IColorInformation[]>()
  const models = new Set<editor.ITextModel>()
  let disposed = false
  const clearModel = (model: editor.ITextModel, invalidate = false): void => {
    const state = modelMap.get(model)
    if (!model.isDisposed())
      model.deltaDecorations(state?.decorationIds ?? [], [])
    if (state)
      releaseColorClasses(state.classNames)
    modelMap.delete(model)
    if (invalidate)
      layerState.invalidate(model)
    else
      layerState.clearLastKnownGood(model)
    models.delete(model)
  }
  const modelDisposeListener = monaco.editor.onWillDisposeModel((model) => {
    const state = modelMap.get(model)
    if (state)
      releaseColorClasses(state.classNames)
    modelMap.delete(model)
    layerState.invalidate(model)
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
        clearModel(model, true)
      layerState.invalidateAll()
    },

    reset() {
      for (const model of [...models])
        clearModel(model, true)
      layerState.invalidateAll()
    },

    async provideDocumentColors(model) {
      if (disposed)
        return

      models.add(model)
      const request = layerState.begin(model)
      try {
        const operation = getWorker(model.uri).then((worker) => {
          if (disposed || !request.canCommit())
            return undefined

          return worker.getDocumentColors(String(model.uri), model.getLanguageId())
        })
        const outcome = await raceModelLayerRequest(request, operation)
        if (outcome.kind === 'invalidated')
          return disposed ? undefined : request.getLastKnownGood()

        if (disposed)
          return

        if (!request.canCommit())
          return request.getLastKnownGood()

        const decision = decidePreserveOrClear(outcome.value)

        if (decision.kind === 'preserve')
          return request.getLastKnownGood()

        const editableColors: languages.IColorInformation[] = []
        const nonEditableColors: editor.IModelDeltaDecoration[] = []
        const nonEditableColorClasses = new Set<string>()
        if (decision.kind === 'set') {
          for (const lsColor of decision.items) {
            const monacoColor = toColorInformation(lsColor)
            const text = model.getValueInRange(monacoColor.range)
            if (parseEditableColorUtility(text)) {
              editableColors.push(monacoColor)
            }
            else {
              const colorClassName = createColorClassName(monacoColor.color)
              nonEditableColorClasses.add(colorClassName)
              nonEditableColors.push({
                range: monacoColor.range,
                options: {
                  before: {
                    content: '\u00A0',
                    inlineClassName: `${colorClassName} colorpicker-color-decoration`,
                    inlineClassNameAffectsLetterSpacing: true,
                  },
                },
              })
            }
          }
        }

        const previousState = modelMap.get(model)
        const addedClassNames = new Set(
          [...nonEditableColorClasses]
            .filter(className => !previousState?.classNames.has(className)),
        )
        for (const className of addedClassNames)
          retainColorClass(className)

        let decorationIds: string[]
        try {
          decorationIds = model.deltaDecorations(
            previousState?.decorationIds ?? [],
            nonEditableColors,
          )
        }
        catch (error) {
          releaseColorClasses(addedClassNames)
          throw error
        }

        if (!request.canCommit()) {
          try {
            if (!model.isDisposed())
              model.deltaDecorations(decorationIds, [])
          }
          finally {
            releaseColorClasses(addedClassNames)
          }

          return request.getLastKnownGood()
        }

        if (previousState) {
          releaseColorClasses(new Set(
            [...previousState.classNames]
              .filter(className => !nonEditableColorClasses.has(className)),
          ))
        }
        modelMap.set(model, { classNames: nonEditableColorClasses, decorationIds })
        request.setLastKnownGood(editableColors)

        return editableColors
      }
      finally {
        request.complete()
      }
    },

    provideColorPresentations(model, colorInformation) {
      const className = model.getValueInRange(colorInformation.range)
      const editableColor = parseEditableColorUtility(className)

      if (!editableColor) {
        return []
      }

      const { color: currentColor, isNamedColor, prefix } = editableColor
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
