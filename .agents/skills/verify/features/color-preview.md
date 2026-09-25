# Color preview

Color utilities get a color swatch in the HTML editor. Theme colors such as `text-cyan-600` get a static chip. Arbitrary colors such as `bg-[#ff0000]` get Monaco's color decorator, which opens a picker that rewrites the utility.

## Sub-features

- `color-chip` paints a static chip in front of a theme color.
- `color-picker-open` opens the picker from the decorator on an arbitrary color.
- `color-picker-apply` rewrites the utility and the generated CSS after a pick.

## How to get to it (user POV)

- Keep or type a theme color utility and look for the swatch in front of it.
- Type an arbitrary color such as `bg-[#ff0000]` and click the swatch in front of it.
- Click a hue or a saturation point in the picker.

## Driving it with drive and agent-browser

Preconditions:

- `drive open light` printed a byte count.

- **Theme chip.** `drive state` shows `unocssColorChips` above zero once the chips paint. Seed lines such as 21 (`border="~ stone-200 ..."`) show chips in the screenshot. Capture `chips`.
- **Open the picker.** Run `drive goto 32`, `agent-browser press Enter`, `agent-browser keyboard type '<b class="bg-[#ff0000]">red'`, and `agent-browser press Escape`. The new line keeps the token near the left edge. `drive click-color 'bg-[#ff0000]'` prints the picker header `bg-[#ff0000]`. Capture `picker`.
- **Apply.** Run `agent-browser click '.colorpicker-widget .hue-strip'`. `drive state` shows `colorPicker` as a new value such as `bg-[#00eeff]`, and `drive lines 'bg-['` shows the same utility. `drive wait-css` on that hex matches. Capture `after`, and the preview word `red` changes background.
- **Theme color is not editable.** `drive click-color text-cyan-600` clicks the static chip and fails with `color picker did not open`. That failure is the expected result.

## Gotchas

- The picker is clipped at the right edge of the HTML pane. With the token near the pane's middle, the saturation box center and the hue strip sit under the preview pane, and `agent-browser click` reports them covered. Keep arbitrary colors near the left edge.
- The decorator shows up only after the color request returns. `click-color` waits for the decorator directly in front of the token. A nearby theme chip is not a match.
- The chip adds an injected non-breaking space, so `drive lines` shows `class=" bg-[...]"`. The document has no space there.
- Editing HTML cancels in-flight color requests. Assert chips only after the CSS for the edit has landed.
