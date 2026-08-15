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

## `.mjs` vs `*.ts` discovery note

Pi auto-discovers `*.ts` / `*/index.ts` under `~/.pi/agent/extensions/` and
`.pi/extensions/`. The package extension here is loaded via the **explicit**
`pi.extensions` path (`./bin/gate/adapters/pi.mjs`), not the extensions-dir scan,
so `.mjs` (valid ESM) is referenced directly. Live-loader support for `.mjs`
through the package channel is unverified against a real pi install — if a target
pi version does not load `.mjs`, rewrite the adapter as `pi.ts` and update both
`piPackageKey()` (manifests.mjs) and the emitted `pi.extensions` path.

## Install for Pi

```bash
pi install npm:@oscaner-skills/engineering
```

Pi loads the extension from the installed package's `pi.extensions` list; the
`skills` entry registers the engineering skills namespace.
