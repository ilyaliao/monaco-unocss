# monaco-unocss playground verification map

This directory is the maintained source for verifying the playground a user actually sees. Read this index, then drive the matching feature file.

## Baseline preconditions

- Launch with `.cursor/skills/verify-monaco-unocss/bin/verify-playground launch`.
- Doctor must report `url=http://127.0.0.1:5177/` (unless you overrode `VERIFY_PORT`), `title=monaco-unocss playground`, and a `listen_pid` inside the recorded process tree.
- Viewport at least 1280x800. The playground sets `min-width: 720px` on `body` and overflow is hidden.
- Never drive a Vite server that this run did not start. In particular never drive `http://127.0.0.1:5173/`.
- Seed HTML is `playground/src/constants.ts`. After load the HTML editor contains `Compose utilities as attributes.` and the preview card contains `Hover this action`.

## Driving conventions

- Start every recipe from a fresh load of the doctor URL unless the feature file says otherwise.
- Click the HTML textbox `Editable HTML document` before typing.
- Wait for the CSS pane live region to show a byte count before asserting CSS or preview.
- Use CDP only to read the preview iframe. Do not use it to set editor text.
- Restore nothing on disk. Playground state is in-memory. Reload the page to reset.

## Proof and skip reporting

- Capture the action and the result, not only the last screenshot.
- UI proof includes an ARIA snapshot and a screenshot with the HTML, Preview, and CSS panes visible.
- Generation proof includes `preview-css.txt` from `style[data-monaco-unocss="generated"]` inside the preview iframe.
- Record the feature id and entry point in `artifacts/<feature-id>/notes.md`.
- If an entry point is unreachable, report the attempted keypress or click and the unmet precondition. Do not mark it verified via a different path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph of user-visible behavior. It then uses exactly these four H2 sections: `Sub-features`, `How to get to it (user POV)`, `Driving it with the Cursor browser`, `Gotchas`.

## Features

- [Live CSS generation](./live-generate.md) covers first paint, typing a utility, attributify, and the preview iframe.
- [Utility completion](./complete.md) covers Ctrl+Space completions for class names and attributify prefixes.
- [Hover CSS](./hover.md) covers Monaco hover markdown for a matched utility.
- [Color preview](./color-preview.md) covers color chips on theme colors and the picker on arbitrary colors.
- [Theme toggle](./theme.md) covers the dark-theme button, playground chrome, and the preview `dark` class.
