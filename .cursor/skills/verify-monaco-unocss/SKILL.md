---
name: verify-monaco-unocss
description: Drive the monaco-unocss playground in a real browser to prove live CSS generation, completions, hover CSS, color decorations, and the theme toggle. Use when verifying playground behavior, reproducing Monaco language-feature bugs, or capturing before/after evidence for monaco-unocss UI changes.
---

# Verify monaco-unocss

This skill drives the **playground**, not the unit tests. A passing `pnpm test` does not prove the three panes, Monaco widgets, or the preview iframe.

The playground is a Vite Vue app. Left pane is an HTML Monaco editor. Right side stacks a live preview iframe over a read-only CSS Monaco editor. Typing HTML (class names or attributify attributes) regenerates CSS through `monaco-unocss` and morphs the iframe without reloading it.

`examples/vite` is a single editor with no preview panes. Use it only when the bug is specific to that example. Do not treat worker tests in `test/` as a user path.

## Launch

From the repo root:

```bash
.cursor/skills/verify-monaco-unocss/bin/verify-playground launch
```

That starts `pnpm --dir playground exec vite --host 127.0.0.1 --port 5177 --strictPort`. Do not pass a bare `--` before Vite flags; Vite then ignores `--port` and binds 5173. Ready means the helper printed `ok=true` and `title=monaco-unocss playground`. The Vite process is started in its own session so it keeps running after `launch` exits. Vite writes `Local:   http://127.0.0.1:5177/` to `.cursor/skills/verify-monaco-unocss/.run/vite.log`.

Do not use `pnpm play`. That binds Vite's default 5173, which is the port a human already using the playground will own. Do not drive 5173, 4173, or any URL `doctor` did not print.

The playground aliases `monaco-unocss` to `src/`. You do not need `pnpm build` for this surface. You do need `node_modules`. The helper runs `pnpm install --frozen-lockfile` if that directory is missing.

Two verification instances cannot share 5177. If the port is taken, the helper refuses rather than stealing it. Set `VERIFY_PORT` to a free port only when 5177 is occupied by something you started on purpose. Never point this skill at an instance you did not launch.

Teardown is `verify-playground cleanup`. Run it after every failed attempt too.

## Doctor

Run this first whenever anything looks off, and before the first interaction after launch:

```bash
.cursor/skills/verify-monaco-unocss/bin/verify-playground doctor
```

Require every line:

- `ok=true`
- `url=http://127.0.0.1:5177/` (or the `VERIFY_HOST`/`VERIFY_PORT` you launched with)
- `pid` alive, and `listen_pid` in that process tree
- `title=monaco-unocss playground`
- `revision` matches `git rev-parse --short HEAD` of this checkout

If doctor fails, stop driving. Read `.run/vite.log`, clean up, and launch again. A page that looks like the playground on another port is not ours.

## Drive

Use the Cursor browser against the doctor URL. Lock the tab after navigate. Prefer roles, accessible names, and the `name` attributes the playground sets on Monaco textareas. Do not click by coordinates unless a fresh screenshot was taken immediately before, and even then only when no named control exists.

Stable handles:

| Control | Handle |
|---|---|
| App identity | heading `monaco-unocss playground` (visually hidden) |
| Skip link | `Skip to playground` |
| Theme toggle | button `Dark theme`, `aria-pressed` true when dark |
| HTML editor | textbox `Editable HTML document`, `textarea[name="editable-html-document"]` |
| CSS editor | textbox `Generated CSS output`, `textarea[name="generated-css-output"]` (read-only) |
| CSS status | the live region in the CSS pane header: `N bytes`, `Generating CSS`, or an error string |
| Preview | iframe `Rendered HTML preview` |
| Completions | `.suggest-widget` once Ctrl+Space has opened it |
| Hover | `.monaco-hover` after Monaco Show Hover |
| Color chips | `.colorpicker-color-decoration` and `.unocss-color-decoration-*` |

The HTML editor seeds `playground/src/constants.ts`. After load you should see `Compose utilities as attributes.` in the HTML pane and a card in the preview that includes `Hover this action`.

CSS generation is debounced 200ms. The CSS header shows `Generating CSS` only after 400ms of being busy. Wait until the live region is a byte count such as `12,345 bytes`, then read CSS and the preview. Do not treat `Generating CSS` as success.

Monaco does not keep the document in the textarea value. `fill`/`clear` on that textarea often no-ops. Click the HTML textbox, then type as a user would. Select-all is `Meta+a` on macOS and `Control+a` elsewhere. If a replace fails, insert a new utility next to an existing one instead of fighting the hidden textarea.

The accessibility snapshot cannot see into the preview iframe. Read the generated CSS with CDP `Runtime.evaluate`:

```js
(() => {
  const frame = document.querySelector('iframe[title="Rendered HTML preview"]')
  const doc = frame && frame.contentDocument
  const style = doc && doc.querySelector('style[data-monaco-unocss="generated"]')
  return {
    heading: doc && doc.querySelector('h1') && doc.querySelector('h1').textContent,
    css: style ? style.textContent : null,
    dark: !!(doc && doc.documentElement.classList.contains('dark')),
  }
})()
```

Read the CSS pane the same way, from the visible Monaco lines, or by confirming the live region plus a screenshot that shows rules such as `/* layer: default */`.

Read `features/README.md`, then the feature file for the behavior under test. A proof that uses one convenient entry point is incomplete when that file lists others.

## Evidence

Write proof under `.cursor/skills/verify-monaco-unocss/artifacts/<feature-id>/`. Cleanup must not delete this directory.

For every run capture:

- The user action and the resulting state, not only the last screen
- An accessibility snapshot (`aria.txt`) that shows playground identity (the heading or pane titles HTML / Preview / CSS)
- A screenshot with those three panes visible (`before.png` and `after.png`, or `ready.png` for a load-only check)
- Side effects next to what is on screen: the iframe `style[data-monaco-unocss="generated"]` text in `preview-css.txt`, and the CSS pane live-region string in `css-detail.txt`
- `notes.md` with feature id, entry point, doctor URL, and `revision`

Proof rules:

- Type in the HTML editor. Do not call `generateStylesFromContent` from the console, and do not poke Vue refs.
- Completions and hover must come from Monaco widgets after a real keypress, not from worker tests.
- Preview CSS must come from the iframe style tag, not from a mocked network response. The playground has no test-only CSS endpoint.
- Worker unit tests are not evidence for this skill.

## Cleanup

```bash
.cursor/skills/verify-monaco-unocss/bin/verify-playground cleanup
```

This kills the process tree recorded in `.run/instance.json` and deletes `.run/`. It does not delete `artifacts/`. It does not kill by process name. After cleanup, confirm the artifact files still exist.

You may close the verification browser tab. Do not close other tabs. Do not kill a Vite server on 5173.

If launch or doctor failed partway, still run cleanup so 5177 is not left bound.

## Helpers

`verify-playground` lives at `.cursor/skills/verify-monaco-unocss/bin/verify-playground`.

```bash
.cursor/skills/verify-monaco-unocss/bin/verify-playground launch
.cursor/skills/verify-monaco-unocss/bin/verify-playground doctor
.cursor/skills/verify-monaco-unocss/bin/verify-playground cleanup
```

`launch` already prints a doctor report when ready. Re-run `doctor` after a refresh, a crash, or any doubt about who owns the port.
