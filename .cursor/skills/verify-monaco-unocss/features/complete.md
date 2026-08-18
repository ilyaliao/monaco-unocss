# Utility completion

Completion offers UnoCSS utilities in the HTML editor through Monaco's suggest widget. It covers class-name prefixes and attributify prefixes from the playground worker config (Wind3, attributify, icons, typography).

## Sub-features

- `complete-open` opens the suggest widget with Ctrl+Space (Control+Space on non-macOS).
- `complete-class` offers class utilities for a prefix such as `text-`.
- `complete-attributify` offers attributify completions inside an attribute such as `text="`.
- `complete-accept` inserts a selected utility into the HTML document.

## How to get to it (user POV)

- Place the caret after a class prefix such as `class="text-` and press Ctrl+Space.
- Place the caret inside an attributify attribute such as `text="` and press Ctrl+Space.
- Type a prefix and accept a suggestion with Enter.

## Driving it with the Cursor browser

Preconditions:

- Doctor reports a healthy instance at `http://127.0.0.1:5177/`.
- The HTML textbox is focused.
- CSS generation for the current document has already reached a byte count, so the UnoCSS worker is alive.

- **Open widget.** Click `Editable HTML document`. Move the caret after a `text-` prefix in a `class` attribute. Press Control+Space (macOS: Control+Space, not Command+Space). A `.suggest-widget` becomes visible.
- **Class prefix.** With the widget open on `text-`, the list includes utilities such as `text-red-5` or `text-sky-500`. Screenshot the widget. Do not treat an empty widget as a pass.
- **Attributify prefix.** Reload if the widget is stuck. Place the caret after `text="` in an attributify attribute and press Control+Space. The list includes color or scale values, not only unrelated HTML attributes.
- **Accept.** Choose one utility with Enter. The HTML editor contains the inserted text. After the debounce, the CSS pane byte count changes and `preview-css.txt` contains a rule for that utility.
- **Proof.** Save `widget.png` with `.suggest-widget` visible, `aria.txt`, and if a suggestion was accepted, `after.png` plus `preview-css.txt`. `notes.md` names `complete` and the entry point (`class` or attributify).

## Gotchas

- Command+Space is Spotlight on macOS. Completions use Control+Space.
- HTML language completions can mix with UnoCSS items. Assert a known UnoCSS utility in the list, not merely that some widget opened.
- The caret must sit in a token UnoCSS will complete. A caret in `</title>` will not prove this feature.
- If the worker is still starting, the first Ctrl+Space can be empty. Wait for the CSS byte count, then retry once.
- Closing the widget with Escape is not a failure. Reopen it before asserting items.
