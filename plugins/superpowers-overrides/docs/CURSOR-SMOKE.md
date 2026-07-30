# Cursor Manual Smoke Checklist

Run after installing plugins from the `oscaner` marketplace.

Reference: [cross-harness-overrides.md](./cross-harness-overrides.md)

## Team Marketplace install (primary)

- [ ] Admin imports `https://github.com/Oscaner/skills` in Dashboard → Settings → Plugins → Team Marketplaces
- [ ] Member installs all needed plugins from Customize → Plugins (`superpowers`, `superpowers-overrides`, etc.)
- [ ] Cursor Dashboard lists four plugins after import
- [ ] Agent skills list shows **13** `spor-*` skills (including `spor-init`, `spor-subagent-lifecycle`, `spor-token-efficient-review-dispatch`)
- [ ] `/spor-brainstorming` attaches override skill
- [ ] Run `/spor-init` → `.cursor/rules/superpowers-overrides.mdc` exists
- [ ] `/superpowers:brainstorming` or attached upstream → agent invokes `spor-brainstorming` first (check tool trace)

## Discovery fallback (non-Team users)

If Team Marketplace is unavailable:

- [ ] Copy from `plugins/superpowers-overrides/skills/*` into project `.cursor/skills/`
- [ ] Copy upstream from `plugins/superpowers/skills/*` into project `.cursor/skills/`
- [ ] Repeat skill list and `/spor-brainstorming` checks above

## Claude Code regression

- [ ] `/superpowers:brainstorming` → `Skill(superpowers-overrides:spor-brainstorming)` first

After editing override skills, manifest, or generators:

```bash
pnpm run generate:overrides   # when manifest or templates change
pnpm run emit
pnpm run validate
```

## Post-release smoke

After merging a Version PR:

- [ ] Git tag exists: `superpowers-overrides@{version}` (e.g. `superpowers-overrides@6.2.0-overrides.4`)
- [ ] `marketplace/source.json` and emitted `.claude-plugin/marketplace.json` `superpowers-overrides.version` match the tag version
- [ ] `plugins/superpowers-overrides/CHANGELOG.md` entry exists for that version
