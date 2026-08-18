# Color preview

Color utilities show a color chip in the HTML editor. Theme colors such as `text-red-5` get a static chip. Arbitrary colors such as `bg-[#ff0000]` are editable through Monaco's color picker.

## Sub-features

- `color-chip` paints a chip on a non-editable theme color.
- `color-picker-open` opens the color picker on an arbitrary color utility.
- `color-picker-apply` changes the utility text after picking a presentation such as `bg-[#00ff00]`.

## How to get to it (user POV)

- Type or keep a theme color utility such as `text-red-5` or `bg-cyan-600` and wait for decorations.
- Type an arbitrary color such as `bg-[#ff0000]` and click the Monaco color decorator.
- Choose a presentation from the picker (`bg-[#...]`, `bg-[rgb(...)]`, `bg-[hsl(...)]`).

## Driving it with the Cursor browser

Preconditions:

- Doctor reports a healthy instance at `http://127.0.0.1:5177/`.
- The HTML document contains both a theme color and an arbitrary color, or you add them first via [live-generate](./live-generate.md).
- CSS generation has reached a byte count.

- **Theme chip.** After generation, query `.colorpicker-color-decoration` or `[class*="unocss-color-decoration-"]` in the HTML pane. At least one chip exists next to a color utility. Screenshot the gutter/inline chip.
- **Open picker.** Add `class="bg-[#ff0000]"` if the seed has no arbitrary color. Click the color decorator Monaco places on that range. The color picker widget appears.
- **Apply.** Choose a green presentation such as `bg-[#00ff00]`. The HTML editor text changes to that utility. After debounce, `preview-css.txt` contains the new color.
- **Proof.** Save `chips.png` (and `picker.png` if the picker opened), `aria.txt`, and `preview-css.txt` when a color changed. `notes.md` names `color-preview` and whether the chip or the picker was the entry point.

## Gotchas

- Chips are delayed until `provideDocumentColors` returns. Wait for the CSS byte count, then wait until the decoration class exists. A screenshot taken immediately after load can miss them.
- Theme colors are not editable. Clicking `text-red-5` must not be reported as a picker failure.
- Arbitrary colors use Monaco's native color decorator, not the `unocss-color-decoration-*` inline chip. Look for the picker square on that token.
- Editing HTML invalidates in-flight color requests. Do not assert chips while the live region still says `Generating CSS`.
- The seed document uses `text-cyan-600` and `bg="stone-900 ..."`. Those are enough for `color-chip`. They are not enough for `color-picker-open`.
