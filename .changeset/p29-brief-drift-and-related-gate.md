---
"@oscaner-skills/cdd-engine": minor
---

A wave's brief fingerprint now covers the task sections alone, a closed wave no longer holds
later dispatches, and the two kinds of drift are told apart on the refusal line.

- **Task-only brief hash.** The wave line's reviewed identity hashes the brief's task
  projection: a `## Constraints` reword — dispatch input for the child, never part of the
  reopen fingerprint — no longer reopens a reviewed wave, while a change inside the wave's
  own tasks still does. The child brief keeps carrying the full plan mirror, Constraints
  included.
- **Closed waves are not re-trodden.** The upstream station reads brief drift only over
  batches that are not yet closed, so a plan edit after a wave finished can no longer block
  the branch review with an upstream drift that names a round nobody will run again.
- **`brief-drift` beside `doc-drift`.** A reason token per layer: a wave brief's movement and
  a document revision's movement no longer share one word. A drifted open wave refuses the
  faces below it as `brief-drift` and points `next:` at that batch's own wave review
  (`review --type wave --tasks …`), instead of hanging the pipeline frontier's branch hop on
  the brief's reason; document drift keeps `doc-drift` with its review reopen unchanged.
- **Mandatory drift diagnosis.** Every `brief-drift` / `doc-drift` refusal line now prints the
  layer, the line key and both hash ends (`recorded=` / `current=`) — the facts an operator
  used to reconstruct by hand.
- **`issue render` related shape gate.** A flattened or non-object `related` value is refused
  with exit 1 and its field path, exactly as `findings[]` already was; a legal nested object
  still renders the dedup / related sections, and an absent `related` stays legal.
