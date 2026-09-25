---
name: verify
description: Drive the monaco-unocss playground in a real headless Chrome through agent-browser to prove live CSS generation, utility completion, hover CSS, color chips and the color picker, and the theme toggle. Use when verifying playground or Monaco language-feature behavior, reproducing a UI bug before fixing it, or capturing before/after evidence for a monaco-unocss change.
---

# Verify monaco-unocss

This skill drives the playground, not the unit tests. A passing `pnpm test` does not prove the three panes, the Monaco widgets, or the preview iframe.

The playground is a Vite Vue app. The left pane is an HTML Monaco editor. The right side stacks a live preview iframe over a read-only CSS Monaco editor. Typing HTML (class names or attributify attributes) regenerates CSS through `monaco-unocss` and morphs the iframe without a reload. The playground aliases `monaco-unocss` to `src/`, so no `pnpm build` is needed.

`examples/vite` is a single editor with no preview. Use it only when a bug is specific to that example. Worker tests in `test/` are not a user path.

The browser harness is the `agent-browser` CLI. Install it once with `npm i -g agent-browser && agent-browser install`. On a Linux image without browser libraries, use `agent-browser install --with-deps`.

Run every command from the repo root.

## Launch

```bash
.agents/skills/verify/bin/verify-playground launch
```

Ready means the output has `ok=true` and `url=http://127.0.0.1:5177/`. Vite logs to `.agents/skills/verify/.run/vite.log`.

The launcher uses port 5177. `pnpm play` uses 5173, which a human may have open. If 5177 is taken, the launcher refuses. Launch with `VERIFY_PORT=<free port>` only when 5177 belongs to something you started on purpose. Never steal a port, and never drive a URL that doctor did not print.

`doctor` and `cleanup` read the port from `.run/instance.json`, so they need no `VERIFY_PORT`.

## Doctor

```bash
.agents/skills/verify/bin/verify-playground doctor
```

Run it before driving and whenever anything looks off. Require `ok=true`, the URL you launched, `title=monaco-unocss playground`, and `revision` equal to `git rev-parse --short HEAD`. If doctor fails, stop driving, read `.run/vite.log`, clean up, and launch again.

## Drive

The harness is `agent-browser` with a named session, wrapped by `.agents/skills/verify/bin/drive`. Each Bash tool call starts a fresh shell, so start every call that touches the browser with the session export:

```bash
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix verify)"
```

A bare `agent-browser` call without it drives the machine-wide default browser, which other agents share. `drive` refuses to run without the variable.

Open the page:

```bash
.agents/skills/verify/bin/drive open light   # or: open dark
```

`open` runs doctor, pins a 1440x900 viewport and the color scheme, loads the doctor URL, and waits for the first byte count. It also relaunches the session if the page reports `visibilityState=hidden`, because Monaco does not paint a hidden page. `open` prints the CSS status, such as `9,010 bytes`.

`drive` commands:

| Command | What it does |
|---|---|
| `drive state` | JSON with CSS status, theme flags, suggest rows, visible hover text, color decorations, and picker text |
| `drive css` | Generated CSS from the preview iframe `style[data-monaco-unocss="generated"]` |
| `drive lines [substring]` | Rendered HTML editor lines, filtered. Only lines on screen are rendered |
| `drive goto <line>` | Focus the HTML editor, Ctrl+G to the line, caret to line end |
| `drive move <token>` | Real mouse move onto the first rendered token. This opens the Monaco hover |
| `drive click-color <token>` | Wait for the color decorator in front of the token, click it, and wait for the picker |
| `drive wait-css <regex>` | Wait until the preview CSS matches the JS regex |
| `drive wait-hover <text>` | Wait until a visible hover contains the text |
| `drive wait-suggest <label>` | Wait until the suggest widget lists the label |
| `drive capture <feature> <step>` | Save a screenshot, an ARIA snapshot, the state, and the CSS under `artifacts/<feature>/` |
| `drive close` | Close this browser session |

Type with real keystrokes through `agent-browser`:

```bash
.agents/skills/verify/bin/drive goto 32
agent-browser keyboard type ' <b class="text-sky-500">sky'
agent-browser press Escape
.agents/skills/verify/bin/drive wait-css '\.text-sky-500\{'
```

Stable handles, if you need raw `agent-browser`:

| Control | Handle |
|---|---|
| Theme toggle | `agent-browser find role button click --name "Dark theme"`. `aria-pressed` is true when dark |
| HTML editor | `textarea[name="editable-html-document"]`, textbox `Editable HTML document`. Use `agent-browser focus`, because `click` hits a covering Monaco span |
| CSS editor | `textarea[name="generated-css-output"]`, read-only |
| CSS status | `.pane-detail[aria-live="polite"]` in the CSS pane header |
| Preview | iframe `Rendered HTML preview`. `agent-browser snapshot` inlines its content |
| Suggest widget | `.suggest-widget.visible .monaco-list-row`, label in `aria-label` |
| Hover | `.monaco-hover` without `hidden` |
| Color chip (theme color) | `[class*="unocss-color-decoration-"]` |
| Color decorator (arbitrary color) | `.colorpicker-color-decoration` with a `dyn-rule-*` class |
| Color picker | `.colorpicker-widget`, with `.saturation-box` and `.hue-strip` |

The seed document is `playground/src/constants.ts`. Line 32 of the HTML editor is `Compose utilities as attributes.`, and the preview heading shows the same text.

Read `features/README.md`, then the feature file for the behavior under test. A proof that uses one convenient entry point is incomplete when the feature file lists others.

## Evidence

Proof goes under `.agents/skills/verify/artifacts/<feature-id>/`. Cleanup never deletes that directory.

For every run:

- Capture before and after the user action: `drive capture <feature> before`, act, wait on the observable result, then `drive capture <feature> after`.
- Each capture writes `<step>.png` (all three panes), `<step>.aria.txt` (playground identity and iframe content), `<step>.state.json`, and `<step>.css` (the generated CSS in the preview iframe).
- Write `notes.md` with the feature id, the entry point, the doctor URL, `revision`, and the exact keys typed.

Proof rules:

- Type in the HTML editor with keystrokes. Do not call `generateStylesFromContent` from the console, set Monaco models, or poke Vue refs.
- Completions and hover must come from Monaco widgets after a real keypress or mouse move.
- Preview CSS comes from the iframe style tag. The playground has no network endpoint to mock.
- Assert the final state, not a transient one. Every keystroke regenerates CSS, so typing `text-sky-50` on the way to `text-sky-500` briefly generates `.text-sky-50`. Wait on the exact final selector, such as `\.text-sky-500\{`.
- Worker unit tests are not evidence for this skill.

## Cleanup

```bash
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix verify)"
.agents/skills/verify/bin/drive close
.agents/skills/verify/bin/verify-playground cleanup
ls .agents/skills/verify/artifacts/
```

`cleanup` kills only the process tree recorded in `.run/instance.json` and deletes `.run/`. It never kills by process name, and it leaves `artifacts/` in place. Run it after failed attempts too, so 5177 is not left bound. Close only your own browser session. Do not touch other `agent-browser` sessions or a Vite server on 5173.

## Helpers

- `bin/verify-playground launch|doctor|cleanup` is the launcher. Run `bin/verify-playground help` for its environment variables.
- `bin/drive` is the agent-browser driver. Run `bin/drive help` for usage. `DRIVE_TIMEOUT_MS` sets its wait timeout (default 20000).
