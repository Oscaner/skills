---
"superpowers-overrides": patch
---

**penf — override-first enforcement (Cursor + Claude Code)**

- **Cursor:** plugin-bundled `hooks-cursor.json` with `beforeSubmitPrompt` detect (pending state) and `preToolUse` enforce (deny non-`spor-*` first tools; allow Read/Skill spor). Marketplace `cursor.hooks` wired via emit.
- **Claude Code:** manifest-generated `hooks.json` matchers for `^superpowers:`, bare `/<slug>`, and `^/spor-<slug>`; expansion script maps all three trigger forms.
- **Generators:** `trigger_patterns.py`, `render-claude-hooks.sh`, `render-cursor-hooks.sh`; shell tests + CI executable checks.
- **Self-check / docs:** red flags for manual upstream SKILL attach; `spor-init` clarifies plugin hooks (no project `.cursor/hooks.json`); CURSOR-SMOKE blocking checklist for penf ship gate.
