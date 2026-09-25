# Utility completion

Completion offers UnoCSS utilities in the HTML editor through Monaco's suggest widget. It covers class-name prefixes and attributify prefixes from the playground config (Wind3, attributify, icons, typography).

## Sub-features

- `complete-open` opens the suggest widget with Ctrl+Space.
- `complete-class` lists class utilities for a prefix such as `text-sky-`.
- `complete-attributify` lists attributify values inside an attribute such as `text="`.
- `complete-accept` inserts the focused utility and regenerates CSS.

## How to get to it (user POV)

- Type a class prefix such as `class="text-sky-` and press Ctrl+Space.
- Type an attributify attribute such as `text="` and press Ctrl+Space.
- Narrow the list by typing, then accept with Enter.

## Driving it with drive and agent-browser

Preconditions:

- `drive open light` printed a byte count, so the worker is alive.

- **Open on a class prefix.** Run `drive goto 32`, `agent-browser keyboard type ' <i class="text-sky-'`, and `agent-browser press Control+Space`. `drive wait-suggest text-sky-500` lists `text-sky-500` among `text-sky-*` rows. Capture `widget`.
- **Accept.** Run `agent-browser keyboard type '500'`. `drive state` shows `suggestFocused` as `text-sky-500`. Run `agent-browser press Enter`. `drive wait-css '\.text-sky-500\{'` matches, and `drive lines '<i class'` shows `class="text-sky-500"`. Capture `after`.
- **Attributify prefix.** From a fresh `drive open`, run `drive goto 32`, `agent-browser keyboard type ' <i text="'`, and `agent-browser press Control+Space`. `drive state` lists UnoCSS values in `suggest`, not only HTML attribute names. Capture `widget-attributify`.

## Gotchas

- Use Control+Space on every platform. Command+Space is Spotlight on macOS.
- The filter is fuzzy. Typing `sky-50` after `text-` focuses `text-stroke-opacity-50`. Type the full prefix before Ctrl+Space, and check `suggestFocused` before Enter.
- HTML completions can mix in. Assert a known UnoCSS utility, not only that the widget opened.
- The caret must sit in a token UnoCSS completes. A caret in `</title>` proves nothing.
- If the first Ctrl+Space is empty, the worker was still starting. Wait for the byte count and retry once.
