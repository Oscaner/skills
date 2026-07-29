# Cursor Manual Smoke Checklist

Run after installing `superpowers` + `superpowers-overrides` from the `oscaner` marketplace.

Reference: [cross-harness-overrides.md](./cross-harness-overrides.md)

- [ ] Install `superpowers` + `superpowers-overrides` from `oscaner` marketplace
- [ ] Agent skills list shows `brainstorming` AND `brainstorming-overrides` (if not: apply discovery fallback from portable spec)
- [ ] `/brainstorming-overrides` attaches override skill
- [ ] Run init → `.cursor/rules/superpowers-overrides.mdc` exists
- [ ] `/superpowers:brainstorming` or attached upstream → agent Read `brainstorming-overrides` first (check tool trace)
- [ ] Claude Code: `/superpowers:brainstorming` → `Skill(superpowers-overrides:brainstorming)` first (no regression)

After editing canonical override skills, rebuild and validate:

```bash
./superpowers-overrides/build/emit-overrides.sh
npm run validate
```

## Post-release smoke

After merging a Version PR:

- [ ] Git tag exists: `superpowers-overrides@{version}` (e.g. `superpowers-overrides@6.2.0-overrides.1`)
- [ ] `.claude-plugin/marketplace.json` `superpowers-overrides.version` matches the tag version
- [ ] `superpowers-overrides/CHANGELOG.md` entry exists for that version
