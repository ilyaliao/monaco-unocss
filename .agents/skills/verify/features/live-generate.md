# Live CSS generation

The playground turns the HTML document into generated CSS and a live preview. Typing a utility as a class name or as an attributify attribute updates the CSS pane and the preview iframe without a reload.

## Sub-features

- `generate-ready` shows CSS and a rendered preview for the seed document after load.
- `generate-class` adds a class utility and updates the CSS and the preview.
- `generate-attributify` adds an attributify attribute and generates the matching CSS.

## How to get to it (user POV)

- Open the playground. The seed HTML generates immediately.
- Type a class name such as `text-sky-500` into the HTML editor.
- Type an attributify attribute such as `text="rose-500"` into the HTML editor.

## Driving it with drive and agent-browser

Preconditions:

- `drive open light` printed a byte count.

- **First paint.** `drive state` shows `status` as a byte count and `previewHeading` as `Compose utilities as attributes.` `drive css` contains `/* layer: default */` and a seed rule such as `[rounded-2xl=""]`. Capture `ready`.
- **Class edit.** Capture `before`. Run `drive goto 32`, then `agent-browser keyboard type ' <b class="text-sky-500">sky'` and `agent-browser press Escape`. `drive wait-css '\.text-sky-500\{'` matches. `drive lines '<b class'` shows the typed text. The status byte count grew. Capture `after`, and the screenshot shows `sky` in sky blue in the preview.
- **Attributify edit.** From a fresh `drive open`, run `drive goto 32`, then `agent-browser keyboard type ' <b text="rose-500">rose'` and `agent-browser press Escape`. `drive wait-css 'rose-500'` matches a `[text~="rose-500"]` selector. Capture `after-attributify`.

## Gotchas

- Every keystroke regenerates CSS. Wait on the full final selector, not a prefix that matched mid-typing.
- The CSS status can keep showing the previous byte count while a short generation runs. It shows `Generating CSS` only after 400ms of work. `wait-css` on the iframe style is the ready signal.
- Monaco auto-closes quotes and tags, and the browser closes an unclosed inline tag at `</h1>`. The typed recipes above end up valid either way. Check `drive lines` if a recipe changes.
- The CSS editor is read-only. Typing there cannot prove generation.
- The seed already uses attributify `text="..."`. A new class utility is a clearer signal than duplicating an existing `text=` attribute.
