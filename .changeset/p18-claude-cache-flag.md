---
"@oscaner-skills/cdd-engine": patch
---

claude dispatch: pass `--exclude-dynamic-system-prompt-sections` so the per-machine sections (cwd, env, memory paths, git status) move out of the system prompt into the first user message. Every CDD dispatch starts a new harness session, so a changing git status alone used to invalidate the tools+system prompt prefix on every round; with the flag the prefix stays byte-stable across dispatches and can be served from the harness prompt cache.