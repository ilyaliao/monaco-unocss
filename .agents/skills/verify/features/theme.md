# Theme toggle

The top-bar button switches the playground between light and dark. It restyles the chrome and both Monaco editors, and it toggles `dark` on the preview root so `dark:` utilities apply.

## Sub-features

- `theme-toggle` flips `aria-pressed` on the `Dark theme` button.
- `theme-chrome` toggles `html.dark` on the app and the Monaco `vs-dark` theme.
- `theme-preview` toggles `dark` on the preview iframe `<html>`, so seed `dark:` utilities apply.

## How to get to it (user POV)

- Click the sun or moon button in the top bar. Its accessible name is `Dark theme`.
- The first theme follows the OS `prefers-color-scheme`.

## Driving it with drive and agent-browser

Preconditions:

- `drive open light` printed a byte count. Use `drive open dark` to check the dark start state.

- **Start state.** `drive state` shows `darkPressed`, `appDark`, `previewDark`, and `htmlEditorDark` all false after `open light`, and all true after `open dark`. Capture `before`.
- **Toggle.** Run `agent-browser find role button click --name "Dark theme"`. All four flags flip together. Capture `after`, and the screenshot shows dark chrome, dark editors, and the dark preview card.
- **Toggle back.** Click again. All four flags return to the start state.

## Gotchas

- `Dark theme` is the accessible name in both states. Match by name, not by the sun or moon icon.
- Assert the flip, not an absolute color. `open` pins the scheme, but a human's browser follows the OS.
- Read `previewDark` from the live iframe document, which `drive state` does. The iframe `srcdoc` covers only the first paint.
- A CSS pane that stays light while the chrome goes dark is a failure.
- This feature does not prove CSS generation. If the preview is blank, run [live-generate](./live-generate.md) first.
