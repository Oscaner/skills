---
"@oscaner-skills/cdd-engine": minor
---

**The reviewed-revision write-back is decided in one place, and a plan that just closed
hands off to `cdd-dev` instead of holding its wave face (P25).** One release entry
covering two distinct faces:

The write-back judgment — which completed round binds a reviewed revision, and to which
leg — now has a single home (`session/reviewed-identity.ts`): the phase whitelist
(review · branch-review · fix) is declared once and the kind → leg mapping (`doc` ·
`brief` · `branch`) is decided once, so the lifecycle's record (`session/run.ts`) and
the dry-run preview (`face/preview.ts`) can no longer drift from each other. **This half
is byte-identical on the consumer face**: `cdd fix --dry-run` and every real run print
and record exactly what they printed and recorded before, and the five `would record:`
assertions of the preview suite are unmodified — that is the evidence. The two
asymmetries the two faces have always carried stay as they were, now stated beside the
judgment instead of being an undocumented divergence: the verdict flag survives on a
real run alone (a dry run holds no verdict), and a wave round whose line carries no plan
path records nothing while the preview still states the brief leg.

The plan-to-dev handoff is a **consumer-visible byte change**, and it is why this entry
is `minor`. In the window where a plan has just closed, carries a task graph, and its
wave face has no round on record, the board's and the capsule's `next:` row reads
`route to /skill:cdd-dev skill` where it printed `implement --plan <plan> --tasks <N>`,
and the `reason:` row reads `closed-line` where it printed `task-open` (the `claude`
host spells the same handoff `route to /kairos:cdd-dev skill`). The wave face is now
judged entered by its own face-level fact — any batch of the plan carrying an implement,
review or fix round — instead of by the line's next hop, which a fresh line always
fills. A same-plan multi-batch run therefore keeps rendering `implement --plan … --tasks
2` at each batch boundary, and once any wave round is recorded both faces return to
their previous bytes. Outside that window nothing changes.

`minor` rather than `patch` by D74: consumer-visible bytes moved. `minor` rather than
`major`: the methodology — design → spec → plan → dev → close — is untouched.
