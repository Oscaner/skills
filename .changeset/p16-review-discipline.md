---
"@oscaner-skills/cdd-engine": minor
---

Review-face discipline hardening: the shared review shell now carries two hard disciplines — (a) read-only: a review mutates no tracked content, index, HEAD, or branch state; its prescribed `OUTPUT_*` artifacts are the only writes, and history is read through `git show` / `git diff` / `git log`; (b) single agent: a review does the whole diff itself and never spawns a subagent for part of it or for a second opinion, overriding any dispatched skill's parallel-sub-agent default. The branch axis gains three judgment points a green run cannot show — design (does the changed structure fit the codebase and is it the simplest structure that solves the plan's problem), test adequacy (would these tests fail if the code broke), and migration (does every breaking change name the path a not-yet-migrated consumer takes). Template contract `$version` 13.

One-shot child-prompt hardening (landed under the same minor): the shared sync-completion clause now names the fact that makes it absolute — ending your turn with anything still running exits the process and the work and the handoff die with it — and the subagent class: a background subagent is a yield-and-wait path exactly like a background command, where `bg_run` / `bg_delegate` had been the only names. Template contract `$version` 14.
