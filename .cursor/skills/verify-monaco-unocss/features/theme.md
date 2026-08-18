# Theme toggle

The toolbar button switches the playground between light and dark. It restyles the chrome and Monaco theme, and it adds or removes `dark` on the preview document root so attributify `dark:` utilities apply.

## Sub-features

- `theme-toggle` flips `aria-pressed` on the `Dark theme` button.
- `theme-chrome` changes playground background tokens (`html.dark` on the app document).
- `theme-preview` toggles `dark` on the preview iframe's `<html>` so seed `dark:` utilities apply.

## How to get to it (user POV)

- Click the sun/moon button in the top bar. Accessible name is `Dark theme`.
- The button is pressed when dark, unpressed when light.

## Driving it with the Cursor browser

Preconditions:

- Doctor reports a healthy instance at `http://127.0.0.1:5177/`.
- Note the initial `aria-pressed` value. The playground follows `prefers-color-scheme`, so dark may already be on.

- **Read start state.** Snapshot. Record whether button `Dark theme` has `aria-pressed` true. Record `document.documentElement.classList.contains('dark')` on the app document, and the preview iframe's `documentElement.classList.contains('dark')` via CDP.
- **Toggle.** Click `Dark theme`. `aria-pressed` flips. The app `html` class `dark` matches the new pressed state. The preview iframe `html.dark` matches it too.
- **Preview effect.** Seed body uses `bg="stone-50 dark:stone-950"`. With dark on, preview CSS still contains both rules, and the iframe root has class `dark` so the dark background applies. Screenshot the preview card against the chrome.
- **Toggle back.** Click the button again. Pressed state, app class, and iframe class return to the start state.
- **Proof.** Save `before.png` and `after.png`, `aria.txt` for both states, and a CDP dump `theme.json` with `{ appDark, previewDark, pressed }`. `notes.md` names `theme`.

## Gotchas

- Initial theme follows the OS. Do not assume light on first load. Assert a flip, not an absolute starting color.
- The preview `srcdoc` is only the first paint. Later updates morph the iframe. After toggle, read `documentElement.className` on the live iframe document, not the `srcdoc` attribute.
- `Dark theme` is the accessible name in both modes. The icon swaps sun/moon. Match the button by name, not by icon class.
- Monaco theme changes with the toggle. A CSS pane that stays white while chrome goes dark is a fail.
- This feature does not prove CSS generation. If the preview is blank, stop and run [live-generate](./live-generate.md) first.
