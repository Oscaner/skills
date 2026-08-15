# Pi gate — manual extension copy

Pi has **no package.json `pi` key mechanism**. Research shows Pi auto-discovers
`*.ts` / `*/index.ts` under `~/.pi/agent/extensions/` and `.pi/extensions/` —
gate wiring for a Pi consumer is a **manual extension copy**, not an
install-and-go package channel.

## How it works

`os-init gates` writes `~/.pi/agent/extensions/engineering.ts` — a thin shim
that re-exports the package's `bin/gate/adapters/pi.mjs` default-export factory:

```ts
// configs/pi/pi.ts (the {{GATE_ADAPTER}} placeholder is replaced at install time)
export { default } from "{{GATE_ADAPTER}}";
```

The shim is **experimental / unverified against a live Pi install** — it assumes
the Pi TS loader can resolve an absolute `.mjs` import from the installed
`@oscaner-skills/engineering` package. The gate core stays in the package, so a
Pi adapter update needs no re-copy of the extension.

## Install for Pi

```bash
os-init gates            # or: os-init gates --harness pi
```

Or copy manually:

```bash
mkdir -p ~/.pi/agent/extensions
printf 'export { default } from "%s";\n' \
  "$(node -p "require.resolve('@oscaner-skills/engineering/bin/gate/adapters/pi.mjs')")" \
  > ~/.pi/agent/extensions/engineering.ts
```

## `configs/pi/`

- `pi.ts` — the native-config template (contains `{{GATE_ADAPTER}}`, so
  `deriveNativeHarnesses` treats `pi` as a native harness).
- `README.md` — this file. The old `package.json` reference (documenting a `pi`
  package key) was deleted — Pi consumes no such key.

If a target Pi version does not load the `.mjs` adapter via the shim, rewrite
`pi.mjs` as `pi.ts` inside the package and update the shim's import target.
