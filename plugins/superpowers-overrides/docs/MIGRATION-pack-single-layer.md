# Migration: pack single-layer contentRoot

**Phase:** pack · **Breaking:** yes (Cursor Team Marketplace install path)

## Why

`superpowers-overrides` now matches upstream **superpowers** layout: harness manifests (`.cursor-plugin`, `.codex-plugin`) live at **plugin root** under `plugins/superpowers-overrides/`. The oscaner-specific wrapper `cursor-plugins/superpowers-overrides/` is **removed**.

Hook scripts and detect/enforce logic are **unchanged** — only install topology changed.

## Cursor Team Marketplace users

1. **Refresh** the `oscaner` Team Marketplace (or reinstall plugins).
2. Confirm `superpowers-overrides` marketplace entry `source` is `./plugins/superpowers-overrides` (not `cursor-plugins/superpowers-overrides`).
3. After install, Settings → Hooks should still show `beforeSubmitPrompt` + `preToolUse` from the plugin.
4. Optional smoke: `/brainstorming` → first tool must be Read/Skill `spor-brainstorming` (see [CURSOR-SMOKE.md](./CURSOR-SMOKE.md)).

## Claude Code users

**No reinstall required.** Plugin cache will include new directories:

- `plugins/superpowers-overrides/.cursor-plugin/`
- `plugins/superpowers-overrides/.codex-plugin/`

Behavior is unchanged; these directories exist for harness parity with upstream superpowers.

## Historical note

The [penf design spec](../../../docs/superpowers/specs/2026-08-05-sdd-token-efficiency-penf-design.md) describes the **wrapper-era** Cursor install path (`cursor-plugins/…`). That was correct for penf ship; **pack** supersedes it with plugin-root manifests.

## Contributors

After changing `package.json`, `.claude-plugin/plugin.json`, or generator templates:

```bash
pnpm run generate:overrides && pnpm run validate
```

Manifest files at plugin root are **generated** — do not hand-edit `.cursor-plugin/plugin.json` or `.codex-plugin/plugin.json`.

<!-- pack smoke: pending manual run -->
