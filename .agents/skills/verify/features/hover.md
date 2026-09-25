# Hover CSS

Hovering a matched UnoCSS utility shows its generated CSS as Monaco hover markdown. The same document feeds completion and the preview.

## Sub-features

- `hover-class` shows CSS for a class or valueless attributify utility under the mouse.
- `hover-attributify` shows CSS for an attributify value such as `stone-500` in `text="xs stone-500"`.
- `hover-keyboard` opens the same hover with the Show Hover chord at the caret.
- `hover-miss` shows no UnoCSS rule for ordinary HTML such as `lang`.

## How to get to it (user POV)

- Move the mouse over a utility in the HTML editor.
- Put the caret in a utility and press Command+K then Command+I on macOS, or Control+K then Control+I elsewhere.

## Driving it with drive and agent-browser

Preconditions:

- `drive open light` printed a byte count, so matched positions exist.

- **Mouse hover.** Run `drive move rounded-2xl`. `drive wait-hover '.rounded-2xl'` prints `/* layer: default */.rounded-2xl,[rounded-2xl=""] { border-radius: 1rem; ...}`. Capture `hover`.
- **Attributify value.** Run `drive move stone-500`. `drive wait-hover 'stone-500'` shows a rule whose selector includes `stone-500`. Capture `hover-attributify`.
- **Keyboard chord.** Run `drive goto 22` (the `rounded-2xl` line), `agent-browser press Home`, then `agent-browser press Meta+k` and `agent-browser press Meta+i`. Use `Control+k` and `Control+i` off macOS. `drive wait-hover '.rounded-2xl'` matches.
- **Miss.** Run `drive move lang`. Within a few seconds `drive state` shows `hover` as null or as HTML help with no CSS rule block.

## Gotchas

- The hover shows up about a second after the mouse settles. Use `wait-hover`, not an immediate `state`.
- `drive move` only finds rendered lines. Run `drive goto <line>` first if the token is off screen.
- The token must fit in one text node. `move` fails loudly on a token split by a color chip. Pick the part after the chip, such as `stone-500`.
- An HTML-language hover can appear instead. Assert a CSS selector and property, not only that a hover opened.
