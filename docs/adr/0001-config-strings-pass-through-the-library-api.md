# Config strings pass through the library API to the worker hook

`setUnocssConfig()` and the `unocssConfig` option accept `UserConfig | string`. A string is not interpreted by the library: it rides `createData` across the postMessage boundary unchanged and lands in the integrator's `prepareUnocssConfig` hook, which decides what a string means. We chose this over a playground-only side channel because the JSDoc had promised string support all along while the type never delivered it, and because `setUnocssConfig`'s existing dispose-worker-and-revalidate semantics are exactly what live config replacement needs — a side channel would duplicate them or lie to the type system.

## Consequences

- Config objects must be structured-cloneable; a string is the only way to express configs containing functions or presets, and only an integrator-supplied `prepareUnocssConfig` can give it meaning.
- The hook's parameter widens from `UserConfig | undefined` to `UserConfig | string | undefined` — an input-position widening that is breaking for existing hook implementations and must be called out on release.
