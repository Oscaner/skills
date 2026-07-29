# Cursor Manual Smoke Checklist

Run after installing `superpowers` + `superpowers-overrides` from the oscaner-skills marketplace.

Reference: [cross-harness-overrides.md](./cross-harness-overrides.md)

- [ ] Install `superpowers` + `superpowers-overrides` from oscaner-skills marketplace
- [ ] Agent skills list shows `brainstorming` AND `brainstorming-overrides` (if not: apply discovery fallback from portable spec)
- [ ] `/brainstorming-overrides` attaches override skill
- [ ] Run init → `.cursor/rules/superpowers-overrides.mdc` exists
- [ ] `/superpowers:brainstorming` or attached upstream → agent Read `brainstorming-overrides` first (check tool trace)
- [ ] Claude Code: `/superpowers:brainstorming` → `Skill(superpowers-overrides:brainstorming)` first (no regression)

After editing canonical override skills, rebuild:

```bash
./superpowers-overrides/build/emit-overrides.sh
./superpowers-overrides/tests/validate-overrides-build.sh
```

Optional — enable emit freshness check in CI after first generated commit:

```bash
ENABLE_EMIT_FRESH_CHECK=1 ./superpowers-overrides/tests/validate-overrides-build.sh
```
