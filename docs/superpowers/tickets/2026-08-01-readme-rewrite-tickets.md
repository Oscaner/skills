# README rewrite tickets

Parent plan: [`docs/superpowers/plans/2026-08-01-readme-rewrite.md`](../plans/2026-08-01-readme-rewrite.md)

---

## T1 — English docs (main + sub README)

**Blocked by:** None

**Plan tasks covered:** Task 1, Task 2

**Demo:** English main README tells the story and links to sub-README; sub-README has mermaid, 13-skill table, Claude/Cursor usage.

**Status:** ready-for-agent

- [ ] `README.md` rewritten (~85–95 lines): hero, why, pipeline, install, quick start, learn more, maintainers, license
- [ ] `plugins/superpowers-overrides/README.md` created (~110–130 lines): overrides intro, mermaid, skills table, usage, maintainer links

---

## T2 — Chinese docs (main + sub README)

**Blocked by:** T1

**Plan tasks covered:** Task 3, Task 4

**Demo:** Four files with mirrored structure; Chinese cross-links point to Chinese sub-README; natural Chinese prose.

**Status:** ready-for-agent

- [ ] `README.zh-CN.md` created with same sections as English main
- [ ] `plugins/superpowers-overrides/README.zh-CN.md` created with same sections as English sub

---

## T3 — Verification

**Blocked by:** T2

**Plan tasks covered:** Task 5

**Demo:** Spec checklist all green; `pnpm run validate` passes; links resolve from both directory levels.

**Status:** ready-for-agent

- [ ] All 8 spec verification items checked
- [ ] Link spot-check from repo root and sub-README directory
- [ ] Optional commit if user requests
