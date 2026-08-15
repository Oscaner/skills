# Gate installation — `@oscaner-skills/engineering`

The **engineering** plugin ships a cross-harness **CDD orchestrator gate**: while a CDD
task is active it blocks direct repo edits (`Write`/`Edit`) and non-read-only `Bash` in
every agent harness that can run the CDD engine. One decision core
(`bin/gate/cdd-gate-core.mjs`) + one adapter per harness
(`bin/gate/adapters/<harness>.mjs`); adapters only translate each harness's native hook
format. The gate ships inside the package — installing the plugin is installing the gate.

## Channel classification

Channels are classified into **three tiers**, kept consistent across this doc, the
[acceptance checklist](#channel-acceptance-checklist), and
[README](../README.md) / [README.zh-CN](../README.zh-CN.md). **Verified** means the
channel is install-and-go or `os-init gates` native config — hooks are live after install
(plus the harness's trust ritual). **Experimental / 待验证** channels are **not** claimed
install-and-go.

| Tier | Channels | Meaning |
|------|----------|---------|
| **Verified** | claude / cursor / grok / qoder / gemini（包通道）+ trae / vibe / kiro（`os-init gates` 原生 config） | 安装后即可生效（或走原生 config），hooks 即活 |
| **Experimental（需人工步骤）** | pi / opencode | 按文档格式接线，但需人工步骤（手动扩展复制 / plugin 配置），不声称 install-and-go |
| **待验证** | codex | 按文档化插件格式接线，但未对真实安装验证 |

> 安装命令一律使用**包安装路径**（`<plugin-root>` = marketplace 实际安装 engineering 的位置），
> 不是 `node <repo>/packages/...` 源 checkout 路径。

Gate semantics are unchanged across harnesses: fail-open when no CDD task is active,
mode-aware (`pending.mode`), git read-only allowlist for `Bash`, and Write paths
bound to the active workspace. Details → [cross-harness-overrides.md](../packages/superpowers-overrides/docs/cross-harness-overrides.md).

---

## Verified — package channel (install-and-go)

### Claude Code (marketplace)

```bash
/plugin marketplace add oscaner/skills
/plugin install engineering@oscaner
```

**Verify:** `/hooks` shows the engineering `PreToolUse` hooks (`Write|Edit` and `Bash`),
each invoking `bin/gate/adapters/claude.mjs`. Start a CDD task and attempt a repo edit
outside the bound workspace → denied.
**Trust:** plugin install is enough — no separate ritual.

### Cursor (marketplace)

Install `engineering` from the marketplace (Cursor Team Marketplace / plugin install).

**Verify:** the Cursor hooks settings list the engineering `preToolUse` hook →
`bin/gate/adapters/cursor.mjs`. Same gate smoke test as Claude Code.
**Trust:** plugin install is enough.

### Grok (native config — recommended; marketplace optional)

Grok reads Claude-compatible plugins, but the **marketplace** path is assumption-based
(unverified against a live Grok install). The guaranteed path is `os-init gates` native
config → `~/.grok/hooks/engineering.json` → `bin/gate/adapters/grok.mjs`:

```bash
os-init gates --harness grok
grok --trust
```

**Verify:** `~/.grok/hooks/engineering.json` exists; during an active CDD task a repo-edit
attempt is denied.
**Trust:** `grok --trust`.

### Qoder (plugin)

Install the `.qoder-plugin` (marketplace or local). The plugin manifest
(`.qoder-plugin/plugin.json`) embeds the gate hook at `.qoder-plugin/hooks/hooks.json`
→ `bin/gate/adapters/qoder.mjs` via the manifest-relative `../bin/...` command.

**Verify:** plugin hooks are active in Qoder; a CDD `Bash`/`Write` deny returns
`permissionDecision: "deny"`.
**Trust:** plugin install is enough.

### Gemini (extension)

```bash
gemini extensions install <repo-url>   # e.g. github.com/Oscaner/skills
```

The extension manifest (`gemini-extension.json`) registers a `BeforeTool` hook
(`write_file | replace | run_shell_command`) → `bin/gate/adapters/gemini.mjs`. The
`type: "command"` hook entry is **intended** — Gemini's documented extension hook shape
uses a `type: "command"` handler with `${extensionPath}` for the extension's own
directory (not a Claude-style `${CLAUDE_PLUGIN_ROOT}` variable).

**Verify:** `gemini extensions list` shows the `engineering` extension; the first CDD
repo-edit attempt triggers the fingerprint confirmation, then `BeforeTool` blocks it.
**Trust:** accept the project hook fingerprint on first use.

## Verified — native config (`os-init gates`)

### Trae / Vibe / Kiro

`os-init gates` copies each harness's native hook config to the machine:

```bash
os-init gates --harness trae,vibe,kiro
```

| Harness | Writes | Trust |
|---------|--------|-------|
| **Trae** | `~/.trae/hooks.json` (Cursor format → `bin/gate/adapters/trae.mjs`) | flip hook **Enable** + sandbox/local execution mode |
| **Vibe** | `~/.vibe/hooks.toml` → `bin/gate/adapters/vibe.mjs` | — |
| **Kiro** | `~/.kiro/hooks/engineering.json` → `bin/gate/adapters/kiro.mjs` | — |

**Verify:** the listed files exist and point at the installed package's
`bin/gate/adapters/<harness>.mjs`; during an active CDD task a repo-edit attempt is
denied in that harness.

---

## Experimental — needs manual steps

Wired to each harness's **documented** format, but **not** install-and-go — they need
manual steps and are not claimed verified against a live install.

### Pi (manual extension copy) — experimental

Pi packages **do** support a `package.json` `pi` key (skills/prompts/themes delivery),
but the gate adapter is `.mjs` while Pi auto-discovers `*.ts` / `*/index.ts` extensions
under `~/.pi/agent/extensions/`. So the gate ships as a **manual extension copy**:
`os-init gates` writes a thin TS shim re-exporting the package's `bin/gate/adapters/pi.mjs`
default-export factory (`pi.on("tool_call", …)`; deny → `{ block: true, reason }`):

```bash
os-init gates --harness pi
```

**Verify:** `~/.pi/agent/extensions/engineering.ts` exists; triggering a gate deny during
a CDD task shows the gate `reason`. The shim assumes the Pi TS loader resolves the
absolute `.mjs` import — **unverified against a live Pi install**.
**Trust:** config write = enabled; re-run `os-init gates` to update the shim.

### OpenCode (plugin module) — experimental

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
call is intercepted (gate deny). The `main` entry + named-export shape is **unverified
against a real OpenCode install**.

---

## 待验证 — wired to documented format, not yet verified

### Codex (plugin) — 待验证

Install the `.codex-plugin` (`.codex-plugin/plugin.json` embeds
`.codex-plugin/hooks/hooks.json` → `bin/gate/adapters/codex.mjs` via the
manifest-relative `../bin/...` command), then review/trust the hooks:

```text
/codex /hooks      # in the Codex session — approve the engineering hooks
```

**Verify:** hooks list shows the engineering gate hook; during an active task a
non-read-only `Bash` is denied (`permissionDecision: "deny"`). The manifest-relative
`../bin/...` command path is documented but **untested against a real Codex install**.

---

## `os-init gates` (native config installer)

For harnesses delivered as native config (trae / vibe / kiro / grok native / pi manual
extension copy), `os-init gates` copies the templates to the machine and prints the
trust ceremony:

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

What it does (idempotent — re-runs merge, never clobber user content; `.ts` targets that
exist and aren't template-generated are skipped, not overwritten):

| Harness | Writes | Trust step |
|---------|--------|------------|
| **Trae** | `~/.trae/hooks.json` (Cursor format → `gate/adapters/trae.mjs`) | [Trust ceremonies](#trust-ceremonies) |
| **Vibe** | `~/.vibe/hooks.toml` → `gate/adapters/vibe.mjs` | — |
| **Kiro** | `~/.kiro/hooks/engineering.json` → `gate/adapters/kiro.mjs` | — |
| **Grok** (optional native) | `~/.grok/hooks/engineering.json` → `gate/adapters/grok.mjs` | [Trust ceremonies](#trust-ceremonies) |
| **Pi** (manual extension copy) | `~/.pi/agent/extensions/engineering.ts` → re-exports `gate/adapters/pi.mjs` | — |

Trust steps are listed once in [Trust ceremonies](#trust-ceremonies) — the authoritative
list for every channel; `os-init gates` prints each harness's next step at install time.

## Channel acceptance checklist

| Channel | Status | Install | Verify |
|---------|--------|---------|--------|
| **Claude / Cursor** | Verified | marketplace install | `/hooks` shows the gate hook; CDD task deny |
| **Grok** | Verified (native) | `os-init gates`（或 marketplace） | `~/.grok/hooks/engineering.json` exists; a gate deny triggers |
| **Qoder** | Verified | install the plugin | plugin hooks active; deny returns `permissionDecision: "deny"` |
| **Gemini** | Verified | `gemini extensions install <repo-url>` | extension in list; `BeforeTool` hook triggers |
| **Trae / Vibe / Kiro** | Verified (native) | `os-init gates` | config file exists; a gate deny triggers |
| **Pi** | Experimental | `os-init gates --harness pi` (manual extension copy) | `~/.pi/agent/extensions/engineering.ts` exists; a gate `tool_call` deny |
| **OpenCode** | Experimental | opencode.json `plugin` array adds the package name | clean startup (no plugin error); `Bash` during a CDD task → gate intercepts |
| **Codex** | 待验证 | install the plugin + `/hooks` trust | hooks list shows the gate; a non-read-only `Bash` deny |

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
