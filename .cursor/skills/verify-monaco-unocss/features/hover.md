# Hover CSS

Hover shows the generated CSS for a matched UnoCSS utility as Monaco hover markdown. The same document that feeds completion and the preview feeds this hover.

## Sub-features

- `hover-class` shows CSS for a class utility under the caret.
- `hover-attributify` shows CSS for an attributify utility under the caret.
- `hover-miss` shows no UnoCSS hover when the caret is on ordinary HTML such as `lang="en"`.

## How to get to it (user POV)

- Put the caret inside a utility token and press the Monaco Show Hover chord: Control+K then Control+I (Command+K then Command+I on macOS).
- Move the mouse over a utility. This path is not available through the Cursor browser key tools. Use the chord.

## Driving it with the Cursor browser

Preconditions:

- Doctor reports a healthy instance at `http://127.0.0.1:5177/`.
- CSS generation has reached a byte count so matched positions exist.
- The HTML textbox is focused.

- **Class hover.** Click `Editable HTML document`. Put the caret in a seed class utility such as `i-carbon-flash-filled` or `group`. Press Command+K then Command+I (Control+K then Control+I off macOS). A `.monaco-hover` appears. It contains a CSS code fence for that utility, not a generic HTML tag description alone.
- **Attributify hover.** Put the caret inside `text-cyan-600` on the seed `text="xs stone-500 dark:stone-400"` line, or inside `rounded-2xl`. The hover markdown includes the generated CSS for that token.
- **Miss.** Put the caret on `lang` in `<html lang="en">` and trigger Show Hover. Either no hover appears, or the hover is HTML language help without a UnoCSS rule block. That is the miss case, not a failure of hover-class.
- **Proof.** Save `hover.png` with `.monaco-hover` visible, `aria.txt`, and `hover.txt` copied from the hover markdown. `notes.md` names `hover` and the token used.

## Gotchas

- Show Hover is a chord. Press K while the modifier is held, then I while it is still held. A lone I types into the buffer.
- Hover uses matched positions from the worker. Triggering it before the first CSS byte count can miss.
- The caret must be inside the token, not on the quote or `=`.
- HTML hover from the HTML worker can appear instead of UnoCSS hover. Assert CSS such as a property and selector, not merely that some hover opened.
- Mouse hover is how a human often does this. The Cursor browser has no hover tool, and CDP `Input.*` is blocked. The keyboard chord is the supported verification path.
