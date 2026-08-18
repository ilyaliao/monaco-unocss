# Live CSS generation

The playground turns the HTML document into generated CSS and a live preview. Typing a utility, whether as a class name or an attributify attribute, updates the CSS pane and the preview iframe without a reload.

## Sub-features

- `generate-ready` shows CSS and a rendered preview for the seed document after load.
- `generate-class` adds a class utility in the HTML editor and updates CSS plus preview.
- `generate-attributify` adds an attributify attribute and generates the matching CSS.

## How to get to it (user POV)

- Open the playground. The seed HTML generates immediately.
- Type a class name such as `text-sky-500` into the HTML editor.
- Type an attributify attribute such as `text="red-5"` into the HTML editor.

## Driving it with the Cursor browser

Preconditions:

- Doctor reports a healthy instance at `http://127.0.0.1:5177/`.
- The page is a fresh load of that URL.
- The HTML textbox still contains `Compose utilities as attributes.`

- **First paint.** Wait until the CSS pane live region is a byte count, not `Generating CSS`. The preview iframe heading is `Compose utilities as attributes.` and `preview-css.txt` contains `/* layer: default */` plus a rule for a seed utility such as `.rounded-2xl` or `.text-cyan-600`.
- **Class edit.** Click the textbox `Editable HTML document`. Insert `class="text-sky-500"` on a new element, or add `text-sky-500` to an existing `class`. Wait for a new byte count. `preview-css.txt` contains `.text-sky-500` and the screenshot shows that rule in the CSS pane.
- **Attributify edit.** In the same editor, add `text="rose-500"` on an element that does not already set `text`. Wait for a new byte count. `preview-css.txt` contains a `[text~="rose-500"]` selector or `.text-rose-500` depending on how the utility was written. The preview text color changes.
- **Proof.** Save `ready.png` or `before.png`/`after.png`, `aria.txt`, `css-detail.txt`, and `preview-css.txt`. `notes.md` names `live-generate` and which sub-feature ran.

## Gotchas

- Generation is debounced 200ms. Assert the live region and iframe style, not a fixed sleep.
- `Generating CSS` can flash and then vanish if generation is fast. A byte count with matching iframe CSS is the ready signal.
- The CSS editor is read-only. Typing there cannot prove generation.
- Monaco's textarea value is not the document. Clearing the textarea often leaves the seed HTML in place.
- The accessibility snapshot cannot see iframe contents. Missing preview CSS in `aria.txt` is expected.
- Seed HTML already uses attributify (`text="3xl sm:4xl"` and similar). Adding `text-sky-500` as a class is a clearer extra signal than duplicating an existing `text=` attribute.
