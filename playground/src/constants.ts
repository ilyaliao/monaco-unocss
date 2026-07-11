export const initialDocument = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>UnoCSS Attributify preview</title>
  </head>
  <body
    min-h-screen
    bg="stone-50 dark:stone-950"
    font-sans
    text="stone-800 dark:stone-100"
  >
    <main
      mx-auto min-h-screen max-w-3xl
      flex="~ items-center"
      p="x-5 y-6 sm:x-7"
    >
      <section
        w-full shadow-sm
        border="~ stone-200 dark:stone-800"
        rounded-2xl
        bg="white dark:stone-900"
        p="5 sm:7"
      >
        <div flex="~ items-center gap-2.5" text="xs stone-500 dark:stone-400">
          <span class="i-carbon-flash-filled text-cyan-600 dark:text-cyan-300" aria-hidden="true"></span>
          <span font-mono uppercase tracking="[0.18em]">monaco-unocss</span>
        </div>

        <h1 m="t-5" text="3xl sm:4xl" font="700" tracking-tight>
          Compose utilities as attributes.
        </h1>
        <p m="t-3" max-w-xl text="sm stone-600 dark:stone-300" leading-6>
          Completions, hover previews, generated CSS, and this preview all share one document.
        </p>

        <div m="t-6" flex="~ wrap" gap-3>
          <button
            class="group"
            flex="~ items-center"
            gap-2 rounded-lg
            bg="stone-900 hover:cyan-700 dark:stone-100 dark:hover:cyan-300"
            p="x-4 y-2.5"
            text="sm white dark:stone-900 dark:hover:stone-950"
            transition-colors
            focus-visible="outline-2 outline-cyan-600 outline-offset-2 dark:outline-cyan-300"
          >
            <span class="i-carbon-play-filled transition-transform group-hover:translate-x-0.5" aria-hidden="true"></span>
            Hover this action
          </button>
        </div>
      </section>
    </main>
  </body>
</html>
`
