# Cursor Manual Smoke Checklist

Run after installing plugins from the `oscaner` marketplace.

Reference: [cross-harness-overrides.md](./cross-harness-overrides.md)

## Team Marketplace install (primary)

- [ ] Admin imports `https://github.com/Oscaner/skills` in Dashboard → Settings → Plugins → Team Marketplaces
- [ ] Member installs all needed plugins from Customize → Plugins (`superpowers`, `superpowers-overrides`, etc.)
- [ ] Cursor Dashboard lists four plugins after import
- [ ] Agent skills list shows `brainstorming` AND `brainstorming-overrides`
- [ ] `/brainstorming-overrides` attaches override skill
- [ ] Run init → `.cursor/rules/superpowers-overrides.mdc` exists
- [ ] `/superpowers:brainstorming` or attached upstream → agent Read `brainstorming-overrides` first (check tool trace)

## Discovery fallback (non-Team users)

If Team Marketplace is unavailable:

- [ ] Copy or symlink `plugins/superpowers-overrides/.cursor/skills/*` into project `.cursor/skills/`
- [ ] Repeat skill list and `/brainstorming-overrides` checks above

## Claude Code regression

- [ ] `/superpowers:brainstorming` → `Skill(superpowers-overrides:brainstorming)` first

After editing canonical override skills or marketplace source:

```bash
pnpm run emit
pnpm run validate
```

## Post-release smoke

After merging a Version PR:

- [ ] Git tag exists: `superpowers-overrides@{version}` (e.g. `superpowers-overrides@6.2.0-overrides.1`)
- [ ] `marketplace/source.json` and emitted `.claude-plugin/marketplace.json` `superpowers-overrides.version` match the tag version
- [ ] `plugins/superpowers-overrides/CHANGELOG.md` entry exists for that version
