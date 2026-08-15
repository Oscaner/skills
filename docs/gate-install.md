# Gate installation — `@oscaner-skills/engineering`

The **engineering** plugin ships a cross-harness **CDD orchestrator gate**: while a CDD
task is active it blocks direct repo edits (`Write`/`Edit`) and non-read-only `Bash` in
every agent harness that can run the CDD engine. One decision core
(`bin/gate/cdd-gate-core.mjs`) + one adapter per harness
(`bin/gate/adapters/<harness>.mjs`); adapters only translate each harness's native hook
format. The gate ships inside the package — installing the plugin is installing the gate.

There are two install paths:

- **Package channel (install-and-go)** — the harness loads the plugin/hook itself; hooks
  are live the moment the package is installed. Applies to **claude, cursor, grok,
  qoder, codex, gemini, pi, opencode**.
- **`os-init gates` (native config)** — for harnesses with no package channel, the
  installer copies a native hook config from `bin/gate/configs/<harness>/` into the
  machine. Applies to **trae, vibe, kiro** (and grok as a native-config alternative).

> Gate semantics are unchanged across harnesses: fail-open when no CDD task is active,
> mode-aware (`pending.mode`), git read-only allowlist for `Bash`, and Write paths
> bound to the active workspace. Details → [cross-harness-overrides.md](../packages/superpowers-overrides/docs/cross-harness-overrides.md).

---

## Package-channel harnesses

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

### Codex (plugin)

Install the `.codex-plugin` (`.codex-plugin/plugin.json` embeds plugin-root `hooks/hooks.json`
→ `bin/gate/adapters/codex.mjs`), then review/trust the hooks (→ [Trust ceremonies](#trust-ceremonies)):

```text
/codex /hooks      # in the Codex session — approve the engineering hooks
```

**Verify:** hooks list shows the engineering gate hook; during an active task a
non-read-only `Bash` is denied (`permissionDecision: "deny"`).

### Gemini (extension)

```bash
gemini extensions install <repo-url>   # e.g. github.com/Oscaner/skills
```

The extension manifest (`gemini-extension.json`) registers a `BeforeTool` hook
(`write_file | replace | run_shell_command`) → `bin/gate/adapters/gemini.mjs`.

**Verify:** `gemini extensions list` shows the `engineering` extension; the first CDD
repo-edit attempt triggers the fingerprint confirmation, then `BeforeTool` blocks it.

### Pi (package)

```bash
pi install @oscaner-skills/engineering
```

The package's `pi` key registers `bin/gate/adapters/pi.mjs` as an in-process TS-style
extension (`pi.on("tool_call", …)`; deny returns `{ block: true, reason }`). If your pi
registry needs an explicit scope prefix, `pi install npm:@oscaner-skills/engineering`
is equivalent.

**Verify:** the extension appears in the pi extension list; triggering a gate deny during
a CDD task shows the gate `reason`.

### OpenCode (config)

Add the package to the `plugin` array of `opencode.json`:

```json
{
  "plugin": ["@oscaner-skills/engineering"]
}
```

OpenCode auto-installs the npm package; the plugin's `tool.execute.before` hook imports
`bin/gate/adapters/opencode.mjs` (in-process, no subprocess).

**Verify:** starting OpenCode shows no plugin error; during an active CDD task a `Bash`
call is intercepted (gate deny).

---

## `os-init gates` (native config — trae / vibe / kiro)

For harnesses with no package channel, `os-init gates` copies the native hook config
templates to the machine and prints the trust ceremony:

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

Trust steps are listed once in [Trust ceremonies](#trust-ceremonies) — the authoritative
list for every channel; `os-init gates` prints each harness's next step at install time.

**Verify:** the listed files exist and point at the installed package's
`bin/gate/adapters/<harness>.mjs`; during an active CDD task a repo-edit attempt is
denied in that harness.

---

## Package-channel acceptance checklist (manual, per channel)

| Channel | Install | Verify |
|---------|---------|--------|
| **Pi** | `pi install @oscaner-skills/engineering` | extension appears in pi list; a gate `tool_call` deny shows the gate reason |
| **OpenCode** | opencode.json `plugin` array adds the package name | clean startup (no plugin error); try `Bash` during a CDD task → gate intercepts |
| **Gemini** | `gemini extensions install <repo-url>` | extension in `gemini extensions list`; `BeforeTool` hook triggers |
| **Qoder / Codex** | install the plugin | plugin hooks active; Codex `/hooks` trust reviewed |
| **Grok** | marketplace **or** `os-init gates` native config | `~/.grok/hooks/engineering.json` exists; a gate deny triggers |

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
