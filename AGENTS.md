# monaco-unocss

`monaco-unocss` wires UnoCSS into the Monaco editor.

It exposes two entry points:

- `monaco-unocss`: registers Monaco language features through `configureMonacoUnocss`.
- `monaco-unocss/unocss.worker`: initializes the worker that owns UnoCSS generation.

The key split is main thread vs worker. Main-thread code adapts Monaco APIs. Worker code talks to UnoCSS.

```mermaid
flowchart LR
  App["User app"] --> Configure["configureMonacoUnocss"]
  Configure --> Providers["Monaco providers"]
  Providers --> MonacoWorker["Monaco createWebWorker"]
  MonacoWorker --> Worker["unocss.worker"]
  Worker --> Factory["Document Session factory"]
  Factory --> Session["Document Session"]
  Worker -->|dispatch with session| Features["worker feature modules"]
  Features -->|pull lazy dependencies| Session
  Session --> Uno["UnoCSS generator"]
```

## Runtime map

### Main thread

- `src/index.ts` creates the Monaco web worker and registers Monaco providers.
- `src/languageFeatures.ts` converts between Monaco types and LSP-style types from `monaco-languageserver-types`.
- `configureMonacoUnocss()` returns one disposable integration object with:
  - `dispose()`
  - `setUnocssConfig()`
  - `generateStylesFromContent()`

### Worker

- `src/unocss.worker.ts` initializes the worker endpoint.
- The worker creates one Document Session factory from the mirror-model getter and prepared UnoCSS config.
- The factory resolves mirrored Monaco models into `TextDocument`-backed sessions.
- The factory owns the generator initialization result, autocomplete memo, model generations, and matched-positions cache for the worker instance.
- Worker feature modules pull only the lazy dependencies they need from the session.

UnoCSS config can contain functions, presets, rules, shortcuts, and extractors. Keep that logic inside the worker by using `prepareUnocssConfig()`.

## Feature modules

- `src/worker/document-session.ts`: document resolution, lazy UnoCSS dependencies, and matched-position cache lifecycle.
- `src/worker/complete.ts`: utility completion and completion item resolution.
- `src/worker/hover.ts`: hover markdown for matched utilities.
- `src/worker/validate.ts`: diagnostics for CSS conflicts and blocklisted utilities.
- `src/worker/code-actions.ts`: quick fixes for supported diagnostics.
- `src/worker/colors.ts`: document color extraction.
- `src/worker/generate-styles.ts`: CSS generation from arbitrary content.
- `src/worker/prettied-css.ts`: generated CSS formatting for hover and completion docs.

## Public types

- `src/types/configure.ts` defines the public API.
- `src/types/worker.ts` defines the worker RPC contract.

Keep these files aligned with `src/index.ts`, `src/unocss.worker.ts`, tests, and README examples when changing exported behavior.

## Language support

`defaultLanguageSelector` currently registers providers for:

- `css`
- `javascript`
- `html`
- `mdx`
- `typescript`

A single marker data provider is registered for the string items of the language selector. Monaco has no general matcher for all `languages.LanguageSelector` shapes here. `setUnocssConfig()` disposes the worker and revalidates that provider so markers refresh without a document edit.

## Diagnostics

Diagnostics are worker-side and come from `src/worker/validate.ts`.

- `cssConflict`: reports utilities in the same class list that generate the same CSS properties.
- `blocklist`: reports utilities blocked by UnoCSS blocklist rules.

Both are enabled by default and can be disabled through `diagnostics`.

## Data flow

```mermaid
sequenceDiagram
  participant Monaco
  participant Adapter as languageFeatures.ts
  participant MonacoWorker as Monaco createWebWorker
  participant Worker as unocss.worker.ts dispatch
  participant Factory as Document Session factory
  participant Feature as worker feature module
  participant Session as Document Session
  participant Uno as UnoCSS generator

  Monaco->>Adapter: completion / hover / colors / markers
  Adapter->>MonacoWorker: get worker for model URI
  MonacoWorker->>Worker: RPC call with URI and language id
  Worker->>Factory: resolveDocument(uri, languageId)
  Factory->>Factory: reconcile model generation and prune cache
  Factory-->>Worker: Document Session
  Worker->>Feature: call with session first
  Feature->>Session: request lazy dependency
  Session->>Uno: initialize, match, or generate
  Uno-->>Session: generated CSS and metadata
  Session-->>Feature: dependency result or undefined
  Feature-->>Worker: LSP-style result or undefined
  Worker-->>Adapter: direct result, or WorkerFeatureResult for colors / markers
  Adapter->>Adapter: preserve, clear, or update colors / markers
  Adapter-->>Monaco: Monaco result
```

## Vendored code

Vendored or adapted logic lives under `src/vendor/*`.

- `defaults-ide.ts`
- `extractor-arbitrary-variants.ts`
- `match-positions.ts`
- `color.ts`
- `css.ts`

Keep upstream attribution intact when touching these files. Avoid mixing copied upstream code directly into `src/worker/*`.

## Tests

Worker behavior is covered in `test/index.test.ts`.
Monaco integration setup is covered in `test/configure.test.ts`.
Public API shape is covered by `test/api.test.ts` snapshots.

The tests use:

- Fake mirror models resolved through the Document Session factory.
- Real UnoCSS configs and generators created by the factory.
- `presetWind3`, `presetWind4`, and `presetAttributify` for feature coverage.
- Direct calls into worker modules with a session or factory as the first argument.
- A new factory per test instead of production-only cache reset hooks.
- `tsnapi` snapshots for public entry points.

Use focused tests for worker behavior before reaching for browser-only verification.

## Commands

Use the package manager pinned by `packageManager` in `package.json`.
pnpm settings and workspace globs live in `pnpm-workspace.yaml`.

- `pnpm build`: build the library with `tsdown`.
- `pnpm test`: run Vitest.
- `pnpm typecheck`: run `tsc --noEmit`.
- `pnpm lint`: run ESLint.
- `pnpm play`: run the interactive playground.

For playground integration checks, start it with `pnpm play` and test all three panes in the browser.
For the minimal Vite example, run `pnpm --dir examples/vite dev`.
For production worker bundling checks, run `pnpm --dir examples/vite exec vite build`.

## Release

`pnpm release` runs `bumpp -r`. It recursively updates package manifests and, by default, commits, tags, and pushes the result. A pushed `v*` tag triggers `.github/workflows/release.yml`, which publishes the package.
