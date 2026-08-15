# pi package key reference

Pi has no CLI hooks manifest — gate wiring ships as a **TS extension** referenced
from the package's `pi` key in `package.json`. This directory documents the `pi`
key shape that the engineering plugin emits, as a reference for packaging the
gate for a Pi consumer.

## The `pi` key

```json
{
  "pi": {
    "extensions": ["./bin/gate/adapters/pi.mjs"],
    "skills": ["./skills"]
  }
}
```

- `extensions` — the in-process gate extension module (`pi.mjs`). Pi loads the
  module's **default-export factory** and registers the gate handler via
  `pi.on("tool_call", …)`; deny returns `{ block: true, reason }`. Path is
  relative to the package root.
- `skills` — the skills directory Pi discovers.

## Where it lives

`packages/engineering/package.json` → `oscaner-plugin.pi` carries the key for
the `@oscaner-skills/engineering` package. It is **emit-generated**
(`scripts/emit.mjs` `ensurePiKey` / `piPackageKey()` in
`scripts/lib/emit/manifests.mjs`) — do not hand-edit the `pi` key; run
`pnpm run emit`.

## Install for Pi

```bash
pi install npm:@oscaner-skills/engineering
```

Pi loads the extension from the installed package's `pi.extensions` list; the
`skills` entry registers the engineering skills namespace.
