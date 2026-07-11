/// <reference types="vite/client" />
/// <reference types="unocss/vite" />
/// <reference path="../../src/monaco-editor-worker.d.ts" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}
