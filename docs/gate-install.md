# Gate installation — `@oscaner-skills/engineering`

The **engineering** plugin ships a cross-harness **CDD orchestrator gate**: while a CDD
task is active it blocks direct repo edits (`Write`/`Edit`) and non-read-only `Bash` in
every agent harness that can run the CDD engine. One decision core
(`bin/gate/cdd-gate-core.mjs`) + one adapter per harness
(`bin/gate/adapters/<harness>.mjs`); adapters only translate each harness's native hook
format. The gate ships inside the package — installing the plugin is installing the gate.

There are three install paths:

- **Verified package channel (install-and-go)** — the harness loads the plugin/hook
  itself; hooks are live the moment the package is installed. Applies to **claude,
  cursor, grok, qoder, gemini**.
- **`os-init gates` (native config)** — the installer copies a native hook config from
  `bin/gate/configs/<harness>/` into the machine. Applies to **trae, vibe, kiro, grok**
  (as a native-config alternative) and **pi** (manual extension copy).
- **Experimental / assumption-based channels** — **codex, opencode** are wired to their
  documented plugin formats but **unverified against a live install**. They are
  documented for completeness, not claimed install-and-go.

> Gate semantics are unchanged across harnesses: fail-open when no CDD task is active,
> mode-aware (`pending.mode`), git read-only allowlist for `Bash`, and Write paths
> bound to the active workspace. Details → [cross-harness-overrides.md](../packages/superpowers-overrides/docs/cross-harness-overrides.md).

---

## Verified package-channel harnesses

### Claude Code (marketplace)

```bash
/plugin marketplace add oscaner/skills
/plugin install engineering@oscaner
```

**Verify:** `/hooks` shows the engineering `PreToolUse` hooks (`Write|Edit` and `Bash`),
each invoking `bin/gate/adapters/claude.mjs`. Start a CDD task and attempt a repo edit
outside the bound workspace → denied.

### Cursor (marketplace)

Install `engineering` from the marketplace (Cursor Team Marketplace / plugin install).

**Verify:** the Cursor hooks settings list the engineering `preToolUse` hook →
`bin/gate/adapters/cursor.mjs`. Same gate smoke test as Claude Code.

### Grok

Two equivalent options — **pick one** (they share the same pending state; running both
is idempotent but redundant):

1. **Marketplace** — (assumption-based; unverified against a live Grok install) Grok reads
   Claude-compatible plugins; install the Claude marketplace
   above and `claude.mjs` is invoked for Grok `PreToolUse`. For a guaranteed `grok.mjs`
   adapter, use the native-config option instead.
2. **Native config (recommended)** — `os-init gates` writes `~/.grok/hooks/engineering.json`
   pointing at `bin/gate/adapters/grok.mjs`, then trust it (→ [Trust ceremonies](#trust-ceremonies)):

   ```bash
   grok --trust
   ```

**Verify:** `~/.grok/hooks/engineering.json` exists; during an active CDD task a repo-edit
attempt is denied.

### Qoder (plugin)

Install the `.qoder-plugin` (marketplace or local). The plugin manifest embeds the gate
hook under `.qoder-plugin/hooks/hooks.json` → `bin/gate/adapters/qoder.mjs`.

**Verify:** plugin hooks are active in Qoder; a CDD `Bash`/`Write` deny returns
`permissionDecision: "deny"`.

### Gemini (extension)

```bash
gemini extensions install <repo-url>   # e.g. github.com/Oscaner/skills
```

The extension manifest (`gemini-extension.json`) registers a `BeforeTool` hook
(`write_file | replace | run_shell_command`) → `bin/gate/adapters/gemini.mjs`. The
`type: "command"` hook entry is **intended** — Gemini's documented extension hook shape
uses a `type: "command"` handler with `${extensionPath}` for the extension's own
directory (not a Claude-style `${PLUGIN_ROOT}` variable).

**Verify:** `gemini extensions list` shows the `engineering` extension; the first CDD
repo-edit attempt triggers the fingerprint confirmation, then `BeforeTool` blocks it.

---

## Experimental / assumption-based channels

Wired to each harness's **documented** plugin format, but **not verified against a live
install** — do not expect install-and-go. Report issues so the channel can graduate to
verified.

### Codex (plugin) — experimental

Install the `.codex-plugin` (`.codex-plugin/plugin.json` embeds plugin-root `hooks/hooks.json`
→ `bin/gate/adapters/codex.mjs` via the `${PLUGIN_ROOT}` substitution Codex applies to
plugin hook commands), then review/trust the hooks (→ [Trust ceremonies](#trust-ceremonies)):

```text
/codex /hooks      # in the Codex session — approve the engineering hooks
```

**Verify:** hooks list shows the engineering gate hook; during an active task a
non-read-only `Bash` is denied (`permissionDecision: "deny"`). The `${PLUGIN_ROOT}`
command path is documented but untested against a real Codex install.

### OpenCode (config) — experimental

Add the package to the `plugin` array of `opencode.json`:

```json
{
  "plugin": ["@oscaner-skills/engineering"]
}
```

OpenCode auto-installs the npm package; `package.json#main` points at
`bin/gate/adapters/opencode.mjs`, whose named `cddGate` export is the plugin function
(OpenCode scans module function exports). The `tool.execute.before` hook imports it
in-process (no subprocess).

**Verify:** starting OpenCode shows no plugin error; during an active CDD task a `Bash`
call is intercepted (gate deny). The `main` entry + named-export shape is documented but
untested against a real OpenCode install.

### Pi (manual extension copy) — experimental

Pi has **no package.json `pi` key mechanism** — it auto-discovers `*.ts` / `*/index.ts`
under `~/.pi/agent/extensions/` and `.pi/extensions/`. `os-init gates` writes a thin TS
shim that re-exports the package's `bin/gate/adapters/pi.mjs` default-export factory
(`pi.on("tool_call", …)`; deny returns `{ block: true, reason }`):

```bash
os-init gates --harness pi
```

**Verify:** `~/.pi/agent/extensions/engineering.ts` exists; triggering a gate deny during
a CDD task shows the gate `reason`. The shim assumes the Pi TS loader resolves the
absolute `.mjs` import — unverified against a live Pi install.

---

## `os-init gates` (native config — trae / vibe / kiro / grok / pi)

For harnesses with no verified package channel, `os-init gates` copies the native hook
config templates to the machine and prints the trust ceremony:

```bash
/os-init gates                      # detect → write native config → report
/os-init gates --dry-run            # preview what would be written, write nothing
/os-init gates --harness trae,kiro  # limit to specific harnesses
```

Under the hood it runs the installer from the **installed package** (not a source
checkout — the plugin root is wherever the marketplace installed `engineering`):

```bash
node <plugin-root>/bin/os-init/install-gates.mjs [--harness …] [--dry-run]
```

What it does (idempotent — re-runs merge, never clobber user content):

| Harness | Writes | Trust step |
|---------|--------|------------|
| **Trae** | `~/.trae/hooks.json` (Cursor format → `gate/adapters/trae.mjs`) | [Trust ceremonies](#trust-ceremonies) |
| **Vibe** | `~/.vibe/hooks.toml` → `gate/adapters/vibe.mjs` | — |
| **Kiro** | `~/.kiro/hooks/engineering.json` → `gate/adapters/kiro.mjs` | — |
| **Grok** (optional native) | `~/.grok/hooks/engineering.json` → `gate/adapters/grok.mjs` | [Trust ceremonies](#trust-ceremonies) |
| **Pi** (manual extension copy) | `~/.pi/agent/extensions/engineering.ts` → re-exports `gate/adapters/pi.mjs` | — |

Trust steps are listed once in [Trust ceremonies](#trust-ceremonies) — the authoritative
list for every channel; `os-init gates` prints each harness's next step at install time.

**Verify:** the listed files exist and point at the installed package's
`bin/gate/adapters/<harness>.mjs`; during an active CDD task a repo-edit attempt is
denied in that harness.

---

## Channel acceptance checklist

| Channel | Status | Install | Verify |
|---------|--------|---------|--------|
| **Claude / Cursor** | Verified | marketplace install | `/hooks` shows the gate hook; CDD task deny |
| **Grok** | Verified | marketplace **or** `os-init gates` | `~/.grok/hooks/engineering.json` exists; a gate deny triggers |
| **Qoder** | Verified | install the plugin | plugin hooks active; deny returns `permissionDecision: "deny"` |
| **Gemini** | Verified | `gemini extensions install <repo-url>` | extension in list; `BeforeTool` hook triggers |
| **Trae / Vibe / Kiro** | Verified (native) | `os-init gates` | config file exists; a gate deny triggers |
| **Pi** | Experimental | `os-init gates --harness pi` (manual extension copy) | `~/.pi/agent/extensions/engineering.ts` exists; a gate `tool_call` deny |
| **Codex** | Experimental | install the plugin + `/hooks` trust | hooks list shows the gate; a non-read-only `Bash` deny |
| **OpenCode** | Experimental | opencode.json `plugin` array adds the package name | clean startup (no plugin error); `Bash` during a CDD task → gate intercepts |

## Smoke test (any harness)

1. Start a CDD task (`/subagent-driven-development`, `/executing-plans`, …) so a pending
   session exists.
2. Attempt a mutating repo operation outside the bound workspace — `git push`, a `Write`
   to a path outside `.superpowers/cdd/<plan>/`, or a compound `Bash` command.
3. Expect a **deny** with the gate's recovery message (points to the H6 implement shell
   / the bound workspace).

Outside an active CDD task the gate is fail-open — that is by design, not a broken hook.

## Trust ceremonies

Config written ≠ trusted. After install, complete the harness's trust ritual:

- **Grok** — `grok --trust` (os-init prints it; you can run it yourself)
- **Codex** — `/hooks` and approve the engineering hooks
- **Gemini** — accept the project hook fingerprint on first use
- **Trae** — flip the hook **Enable** button + choose sandbox/local execution mode
- **Qoder / Cursor / Claude Code** — no separate trust ritual; plugin install is enough

## What the gate does not do

- It only enforces **while a CDD task is active**. No pending → allow (fail-open).
- It never copies a full tree or uses a `~/.oscaner/` convention — hooks and adapters
  ship inside the package and are referenced by path.
- It is **not** the trigger router. The superpowers trigger router
  (`superpowers-overrides`) is a separate plugin; `os-init spor` initializes its
  self-check table. `os-init gates` installs only the engineering CDD gate.
