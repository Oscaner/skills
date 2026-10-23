---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/kairos": minor
---

**cdd-engine** — child dispatch pins the prompt cache to five minutes: a claude child is spawned with `FORCE_PROMPT_CACHING_5M=1` and a pi child with `PI_CACHE_RETENTION=short`, both merged over the inherited environment so an inherited opposite value is overridden. The cursor host retires: `HostId` is `claude | pi`, detection no longer reads `CURSOR_TRACE_ID`, and no cursor-specific manifest is emitted.

**kairos** — the `.cursor-plugin` manifest retires from the emitted marketplace, and the README family names Claude Code and Pi only.
