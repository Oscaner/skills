---
"@oscaner-skills/cdd-engine": patch
---

The branch line's handoff identity + the engine's commit-ref form, unified. Three related fixes on the dispatch/handoff surface:

1. **`--plan` on every branch literal（find #8 F1b）** — the `cdd fix --type branch --findings …` and `cdd review --type branch --base … --head …` `next:` literals now render the workspace-identity `--plan <path>`（与 wave fix 分支同构）. Previously a plan-less branch literal resolved its workspace to the bare `ref.short()` directory while the review's ledger lived in the plan-slug workspace — the follow-up fix/re-review landed in an empty ledger and refused with `next round is branch-review`. The literal is now directly dispatchable as written; the orchestrator never completes a flag by hand.

2. **Handoff file names are line-keyed（find #9）** — the branch family's file names drop the range token（`branch-review-dbbcd3d..ffc0c15-r1.json` → `branch-review-1.json`）: the shas already ride the carrier's `commits`, so the range in the name was a second truth. Reports become `branch-review-1-report.md` / `branch-fix-1-report.md`, the evidence file the line's single `branch-test-evidence.json`. The branch progress key is now the stable `"branch"`（per plan workspace）so rounds ACCUMULATE across a re-review loop（review-1 → fix-1 → review-2 → fix-2）— the old range-short key re-created the progress row on every head move and reset the round to 1 forever.

3. **8-char short shas engine-wide（find #10）** — commit refs are the 8-char short form everywhere（`git rev-parse --short=8 HEAD` · `cdd review --base/--head` validating 8-char · the CLI sha channel · the carrier schema's commit row · a branch-range's `--base/--head` flags）; 40-char full shas are retired engine-wide（including the doc-revision content hash, `doc_hash`, sliced to 8）. A legacy 40-char carrier still resolves — sliced at the one `BranchRef` decision, never re-sliced into a shorter token.