declare module 'monaco-editor/esm/vs/common/initialize.js' {
  interface MonacoWorkerMirrorModel {
    getValue: () => string
    uri: unknown
    version: number
  }

  interface MonacoWorkerContext {
    getMirrorModels: () => MonacoWorkerMirrorModel[]
  }

  export function initialize<T, C = unknown>(
    fn: (ctx: MonacoWorkerContext, createData: C) => T,
  ): void
}
