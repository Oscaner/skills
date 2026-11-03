---
"@oscaner-skills/cdd-engine": minor
---

**A plan revision reopens the branch face.** A branch re-review judges the plan revision, so the branch line's identity document is the plan itself — and its dispatch gate now reads that identity: once a plan revision moves past the one a completed branch review bound, `cdd review --type branch` is accepted as the reopened branch-review round instead of being refused as a closed face. An unchanged plan keeps the closed face and its refusal, so a clean branch line is never re-dispatchable by accident.

The derived next hop follows the same identity: a drift-reopened line's active hop is its review lead, so whatever exit-side route a read face observed (the line's own closure, a face-to-face station, or no route at all) is presented as the reopened review hop. `board`'s `next:` and the CLI refusal therefore name one object — `doc-drift · the next round is branch-review` on the branch face — which is the shape the wave closure already hands the user when it points at a branch review. The satisfaction of a dispatch is the gate's ruling and nothing else: the next-step count table's judgment (blocker / warn / nit, the soft cap, the fix hop) is untouched, and an already-open hop keeps its route, because a pending fix outranks drift.
