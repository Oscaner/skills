# Cursor Manual Smoke Checklist

Run after installing plugins from the `oscaner` marketplace.

Reference: [cross-harness-overrides.md](./cross-harness-overrides.md)

## Team Marketplace install (primary)

- [ ] Admin imports `https://github.com/Oscaner/skills` in Dashboard → Settings → Plugins → Team Marketplaces
- [ ] Member installs all needed plugins from Customize → Plugins (`superpowers`, `superpowers-overrides`, etc.)
- [ ] Cursor Dashboard lists four plugins after import
- [ ] Agent skills list shows **4** `spor-*` skills (3 cross-cutting + `spor-bs`) without project `.cursor/skills/` copy
- [ ] `/spor-bs` attaches override skill (direct attach, no Search files)
- [ ] `/superpowers:brainstorming` or attached upstream → agent invokes `spor-bs` first (check tool trace)

## Discovery fallback (non-Team users)

If Team Marketplace is unavailable:

- [ ] Copy from `plugins/superpowers-overrides/skills/*` into project `.cursor/skills/`
- [ ] Copy upstream from `plugins/superpowers/skills/*` into project `.cursor/skills/`
- [ ] Repeat skill list and `/spor-bs` checks above

## Claude Code regression

- [ ] `/superpowers:brainstorming` → `Skill(superpowers-overrides:spor-bs)` first

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
