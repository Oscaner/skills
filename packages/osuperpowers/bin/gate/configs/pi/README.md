# Pi gate — TS extension

Pi packages have a `package.json` `pi` key mechanism — `pi install npm:@x / git:host/repo / path` consumes a `pi` key with conventional dirs (`skills/ extensions/ prompts/ themes/`). The osuperpowers gate is delivered as a **TS extension** (`pi.ts`) that re-exports the package's gate core via the Pi TS loader.

## How it works

`init harness` writes `~/.pi/agent/extensions/osuperpowers.ts` — a thin shim
that re-exports the package's `bin/gate/adapters/pi.ts` default-export factory:

```ts
// configs/pi/pi.ts (the {{GATE_ADAPTER}} placeholder is replaced at install time)
export { default } from "{{GATE_ADAPTER}}";
```

The shim is loaded by the Pi TS loader which discovers `*.ts` / `*/index.ts` under
`~/.pi/agent/extensions/` and `.pi/extensions/`. The gate core stays in the package,
so a Pi adapter update needs no re-copy of the extension.

## Install for Pi

```bash
init harness --harness pi
```

Or copy manually:

```bash
mkdir -p ~/.pi/agent/extensions
printf 'export { default } from "%s";\n' \
  "$(node -p "require.resolve('@oscaner-skills/osuperpowers/bin/gate/adapters/pi.ts')")" \
  > ~/.pi/agent/extensions/osuperpowers.ts
```

## `configs/pi/`

- `pi.ts` — the native-config template (contains `{{GATE_ADAPTER}}`, so
  `deriveNativeHarnesses` treats `pi` as a native harness).
- `README.md` — this file. Pi's `package.json` `pi` key delivers skills / prompts /
  themes, but the gate adapter is `.ts` — Pi extensions are auto-discovered as `*.ts`,
  so the gate is a native config install (via `init harness`) rather than a
  package-channel delivery.

If a target Pi version does not load the `.ts` adapter, check the Pi extension
discovery path and ensure the shim is in the correct location.
