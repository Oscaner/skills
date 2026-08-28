# Gate installation — `@oscaner-skills/osuperpowers`

The **osuperpowers** plugin ships a cross-harness **CDD orchestrator gate**: while a CDD
task is active it blocks direct repo edits (`Write`/`Edit`) and non-read-only `Bash` in
every agent harness that can run the CDD engine. One decision core
(`bin/gate/cdd-gate-core.mjs`) + one adapter per harness
(`bin/gate/adapters/<harness>.mjs`); adapters only translate each harness's native hook
format. The gate ships inside the package — installing the plugin is installing the gate.

## Channel classification

Two channels, **12 harnesses** total (P6b §2.5 authoritative — single SOT shared with
[skills-probe.config.mjs](../packages/osuperpowers/bin/utils/skills-probe.config.mjs)):

| Channel | Harnesses | Missing behavior |
|---------|-----------|------------------|
| **install-and-use** | claude / cursor-agent / droid / grok / qoder / codex / gemini / pi | probe → **exit 3** + per-plugin install hint |
| **init** | opencode / trae / vibe / kiro | probe → stderr 提示 `init harness <name>`（非 exit 3），任务照跑 |

**install-and-use** channels deliver skills + gate hooks via their native install path
(marketplace / plugin / extension / npm package) — no manual copy needed.
**init** channels require `init harness` to write native gate config and copy
skills to the harness directory.

> Gate hooks (CDD orchestrator enforcement) are separate from skills delivery.
> install-and-use channels ship gate hooks via their plugin/extension manifest.
> init channels get gate hooks via `init harness` (native config + skills copy).

Gate semantics are unchanged across harnesses: fail-open when no CDD task is active,
mode-aware (`pending.mode`), git read-only allowlist for `Bash`, and Write paths
bound to the active workspace. Details → [cross-harness-overrides.md](../packages/osuperpowers-router/docs/cross-harness-overrides.md).

---

## install-and-use — package / marketplace channel

### Claude Code (marketplace)

```bash
/plugin marketplace add oscaner/skills
/plugin install osuperpowers@oscaner-skills
```

**Verify:** `/hooks` shows the osuperpowers `PreToolUse` hooks (`Write|Edit` and `Bash`),
each invoking `bin/gate/adapters/claude.mjs`. Start a CDD task and attempt a repo edit
outside the bound workspace → denied.
**Trust:** plugin install is enough — no separate ritual.

### Cursor Agent (marketplace)

Install `osuperpowers` from the marketplace (Cursor Team Marketplace / plugin install).

**Verify:** the Cursor hooks settings list the osuperpowers `preToolUse` hook →
`bin/gate/adapters/cursor.mjs`. Same gate smoke test as Claude Code.
**Trust:** plugin install is enough.

### Droid (skill-dir)

Droid reads skills from `.agents/skills/` — copy the osuperpowers skills directory there.

```bash
cp -r <plugin-root>/skills/* .agents/skills/
```

**Verify:** skills appear in `.agents/skills/`; during an active CDD task a repo-edit
attempt is denied (droid routes through the gate adapter).
**Trust:** no separate trust ritual; skill copy = enabled.

### Grok (marketplace — install-and-use)

Grok reads Claude-compatible plugins via marketplace compatibility. Install the
osuperpowers plugin from the Oscaner marketplace — skills + gate hooks ship together.

```bash
# Grok reads the Claude marketplace
/plugin marketplace add oscaner/skills
/plugin install osuperpowers@oscaner-skills
```

Alternatively, `init harness grok` can guide the marketplace install steps.

**Verify:** `~/.grok/hooks/osuperpowers.json` exists; during an active CDD task a repo-edit
attempt is denied.
**Trust:** `grok --trust`.

### Qoder (plugin)

Install the `.qoder-plugin` (marketplace or local). The plugin manifest
(`.qoder-plugin/plugin.json`) embeds the gate hook at `.qoder-plugin/hooks/hooks.json`
→ `bin/gate/adapters/qoder.mjs` via the manifest-relative `../bin/...` command.

**Verify:** plugin hooks are active in Qoder; a CDD `Bash`/`Write` deny returns
`permissionDecision: "deny"`.
**Trust:** plugin install is enough.

### Codex (plugin — install-and-use)

Install the `.codex-plugin` (`.codex-plugin/plugin.json` embeds
`.codex-plugin/hooks/hooks.json` → `bin/gate/adapters/codex.mjs` via the
manifest-relative `../bin/...` command), then review/trust the hooks:

```text
/codex /hooks      # in the Codex session — approve the osuperpowers hooks
```

**Verify:** hooks list shows the osuperpowers gate hook; during an active task a
non-read-only `Bash` is denied (`permissionDecision: "deny"`).
**Trust:** `/hooks` and approve the osuperpowers hooks.

### Gemini (extension)

```bash
gemini extensions install <repo-url>   # e.g. github.com/Oscaner/skills
```

The extension manifest (`gemini-extension.json`) registers a `BeforeTool` hook
(`write_file | replace | run_shell_command`) → `bin/gate/adapters/gemini.mjs`. The
`type: "command"` hook entry is **intended** — Gemini's documented extension hook shape
uses a `type: "command"` handler with `${extensionPath}` for the extension's own
directory (not a Claude-style `${CLAUDE_PLUGIN_ROOT}` variable).

**Verify:** `gemini extensions list` shows the `osuperpowers` extension; the first CDD
repo-edit attempt triggers the fingerprint confirmation, then `BeforeTool` blocks it.
**Trust:** accept the project hook fingerprint on first use.

### Pi (npm package — install-and-use)

Pi packages support a `package.json` top-level `pi` key (skills + extensions delivery).
The osuperpowers plugin emits a top-level `pi` key with skills and a gate extension
TypeScript shim (`bin/gate/adapters/pi.ts`) that Pi auto-discovers under
`~/.pi/agent/extensions/`.

```bash
pi install npm:@oscaner-skills/osuperpowers
```

**Verify:** `pi list` shows the osuperpowers skills + extensions; triggering a gate deny
during a CDD task shows the gate `reason`.
**Trust:** `pi install` = enabled; re-install to update.

---

## init — native config + skills copy

For harnesses in the init channel (opencode / trae / vibe / kiro), `init harness`
writes native gate config and copies skills to the harness directory:

```bash
init harness                       # detect installed harnesses → multi-select menu
init harness trae,vibe,kiro        # explicit specification
```

### Trae

```bash
init harness trae
```

| Writes | Trust |
|--------|-------|
| `~/.trae/hooks.json` (Cursor format → `bin/gate/adapters/trae.mjs`) + skills to `.trae/skills/` | flip hook **Enable** + sandbox/local execution mode |

**Verify:** `~/.trae/hooks.json` exists and points at the installed package's
`bin/gate/adapters/trae.mjs`; during an active CDD task a repo-edit attempt is denied.

### Vibe

```bash
init harness vibe
```

| Writes | Trust |
|--------|-------|
| `~/.vibe/hooks.toml` → `bin/gate/adapters/vibe.mjs` + skills to `.vibe/skills/` | — |

**Verify:** the listed files exist; a CDD repo-edit attempt is denied.

### Kiro

```bash
init harness kiro
```

| Writes | Trust |
|--------|-------|
| `~/.kiro/hooks/osuperpowers.json` → `bin/gate/adapters/kiro.mjs` + skills to `.kiro/skills/` | — |

**Verify:** the listed files exist; a CDD repo-edit attempt is denied.

### OpenCode

```bash
init harness opencode
```

OpenCode auto-installs the npm package; `package.json#main` points at
`bin/gate/adapters/opencode.mjs`, whose named `cddGate` export is the plugin function
(OpenCode scans module function exports). The `tool.execute.before` hook imports it
in-process (no subprocess).

**Verify:** starting OpenCode shows no plugin error; during an active CDD task a `Bash`
call is intercepted (gate deny).

---

## `init harness` — per-harness installer

`init harness` is the unified installer for all harnesses. It detects installed
harnesses (via `harness-detect` util — `command -v <cli>`), presents a multi-select
menu, and runs per-harness install actions:

| Channel | Action |
|---------|--------|
| install-and-use | probe that harness for installed osuperpowers plugin/gate; if missing → print install command + trust steps |
| init | write native gate config + **copy skills** to harness directory + trust steps |

Under the hood it runs the installer from the **installed package** (not a source
checkout — the plugin root is wherever the marketplace installed `osuperpowers`):

```bash
node <plugin-root>/bin/init/install-harness.mjs [--harness …] [--dry-run]
```

**Manifest full sync** (runs every time):
- Manifest at `~/.osuperpowers/state/<harness>.json` tracks `{ osuperpowersVersion, files: { path → { hash, source } } }`
  where `source = "init"` marks init-written files.
- Re-run diffs manifest vs current file set → auto add/overwrite/delete (no prompting).
- **Delete semantics**: only delete files that (a) were tracked in manifest, (b) not
  user-modified (hash matches), and (c) have `source == "init"`. Untracked user
  files are preserved.

## Channel acceptance checklist

| Channel | Status | Install | Verify |
|---------|--------|---------|--------|
| **Claude** | install-and-use | marketplace install | `/hooks` shows the gate hook; CDD task deny |
| **Cursor Agent** | install-and-use | marketplace install | hooks settings show the gate hook; CDD task deny |
| **Droid** | install-and-use | copy skills to `.agents/skills/` | skills appear; CDD task deny |
| **Grok** | install-and-use | marketplace install (Claude marketplace compat) | `~/.grok/hooks/osuperpowers.json` exists; gate deny |
| **Qoder** | install-and-use | install the plugin | plugin hooks active; deny returns `permissionDecision: "deny"` |
| **Codex** | install-and-use | install the plugin + `/hooks` trust | hooks list shows the gate; a non-read-only `Bash` deny |
| **Gemini** | install-and-use | `gemini extensions install <repo-url>` | extension in list; `BeforeTool` hook triggers |
| **Pi** | install-and-use | `pi install npm:@oscaner-skills/osuperpowers` | `pi list` shows skills + extensions; gate `tool_call` deny |
| **Trae** | init | `init harness trae` | `~/.trae/hooks.json` exists; gate deny |
| **Vibe** | init | `init harness vibe` | `~/.vibe/hooks.toml` exists; gate deny |
| **Kiro** | init | `init harness kiro` | `~/.kiro/hooks/osuperpowers.json` exists; gate deny |
| **OpenCode** | init | `init harness opencode` | clean startup; `Bash` during CDD task → gate intercepts |

## Smoke test (any harness)

1. Start a CDD task (`/subagent-driven-development`, …) so a pending
   session exists.
2. Attempt a mutating repo operation outside the bound workspace — `git push`, a `Write`
   to a path outside `.superpowers/cdd/<plan>/`, or a compound `Bash` command.
3. Expect a **deny** with the gate's recovery message (points to the H6 implement shell
   / the bound workspace).

Outside an active CDD task the gate is fail-open — that is by design, not a broken hook.

## Trust ceremonies

Config written ≠ trusted. After install, complete the harness's trust ritual:

- **Grok** — `grok --trust` (init prints it; you can run it yourself)
- **Codex** — `/hooks` and approve the osuperpowers hooks
- **Gemini** — accept the project hook fingerprint on first use
- **Trae** — flip the hook **Enable** button + choose sandbox/local execution mode
- **Qoder / Cursor / Claude Code** — no separate trust ritual; plugin install is enough

## What the gate does not do

- It only enforces **while a CDD task is active**. No pending → allow (fail-open).
- It never copies a full tree or uses a `~/.oscaner/` convention — hooks and adapters
  ship inside the package and are referenced by path.
- It is **not** the trigger router. The superpowers trigger router
  (`osuperpowers-router`) is a separate plugin; routing is hook-driven
  (manifest-derived `UserPromptExpansion` on Claude, `cursor-detect` on Cursor).
  `init harness` installs only the osuperpowers CDD gate.
