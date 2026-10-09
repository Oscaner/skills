---
"@oscaner-skills/kairos": patch
---

cdd-close flow adjustment — closeout before finish: the closeout backfill (closeout version rows · Phase inventory → Done · acceptance delivery record · change-history row) lands and commits as its own `docs(kairos)` commit BEFORE the finish decision, so the finish menu (merge / PR / keep / discard) never runs over an un-backfilled phase and a merge ships the closeout with the branch. cdd-dev's `handoff-cdd-close` node states the ordering.