# monaco-unocss playground verification map

This directory is the maintained source for verifying the playground a user actually sees. Read this index, then drive the matching feature file.

## Baseline preconditions

- Launch with `.agents/skills/verify/bin/verify-playground launch`.
- Doctor reports `ok=true`, `url=http://127.0.0.1:5177/`, and `title=monaco-unocss playground`.
- Every Bash call that touches the browser starts with `export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix verify)"`.
- `drive open light` (or `dark`) printed a byte count.
- Never drive a Vite server this run did not start. Never drive `http://127.0.0.1:5173/`, which `pnpm play` owns.
- The seed HTML is `playground/src/constants.ts`. HTML editor line 32 is `Compose utilities as attributes.`

## Driving conventions

- `drive` below means `.agents/skills/verify/bin/drive`.
- Start every recipe from `drive open` unless the feature file says otherwise. Playground state lives in memory, and reloading resets it.
- Place the caret with `drive goto <line>`, then type with `agent-browser keyboard type` and `agent-browser press`.
- Press `Escape` after typing to dismiss auto-opened suggestions before asserting anything else.
- Wait on the observable result (`wait-css`, `wait-hover`, `wait-suggest`, `click-color`). Do not use fixed sleeps.
- Use `eval` only to read state. Do not use it to set editor text or call playground APIs.

## Proof and skip reporting

- Run `drive capture <feature-id> before` and `drive capture <feature-id> after` around the user action.
- UI proof includes the ARIA snapshot and a screenshot with the HTML, Preview, and CSS panes visible.
- Generation proof includes `<step>.css` from the preview iframe style tag.
- Record the feature id, the entry point, and the keys typed in `artifacts/<feature-id>/notes.md`.
- If an entry point is unreachable, report the attempted keypress or mouse action and the unmet precondition. Do not mark it verified through a different path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph of user-visible behavior. It then uses exactly these four H2 sections: `Sub-features`, `How to get to it (user POV)`, `Driving it with drive and agent-browser`, `Gotchas`.

## Features

- [Live CSS generation](./live-generate.md) covers first paint, typing a class utility, attributify, and the preview iframe.
- [Utility completion](./complete.md) covers Ctrl+Space completions for class and attributify prefixes and accepting an item.
- [Hover CSS](./hover.md) covers the Monaco hover for a matched utility, by mouse and by keyboard.
- [Color preview](./color-preview.md) covers theme color chips and the picker on arbitrary colors.
- [Theme toggle](./theme.md) covers the dark-theme button, the playground chrome, Monaco, and the preview `dark` class.
