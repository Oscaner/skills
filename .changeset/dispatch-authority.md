---
"@oscaner-skills/cdd-engine": minor
---

P27 — one dispatch authority: the line's phase becomes a verdict, and `next:` joins it.

`cdd-engine` (consumer-visible):

- **One verdict object.** `DispatchAuthority` (`src-next/session/dispatch-authority.ts`) judges a work dispatch over three legs in one priority order — structure → upstream → line — and returns the single `DispatchVerdict` (`{ allowed }` or `{ allowed: false, leg, reason, next }`). The two parallel call sites are gone: the wave face's phase judgment leaves the pre-flight seam (`session/preflight.ts` no longer runs `WaveGate.vet`, and its gate list is now the structure gates alone), and the doc/branch line's readiness judgment leaves the CLI (`face/cli.ts` no longer calls `CliGate#lineGate`). `CliGate#lineGate` stays as the face's line-fact read, never a dispatch authority.
- **Nine refusal rows, one table.** The wave face's five rows (`mixed-batch` · `wave-too-wide` · `too-many-tasks` · `split` · `wrong-phase`) and the doc/branch rows (`pending-fix` · `unchanged` · `face-closed`) now yield a reason token from the ONE table (`DISPATCH_REASON`). The semantics are unchanged row for row; `unchanged` is the new token for the same-revision refusal, which used to carry prose only.
- **`reason · next:` on the refusal line.** A line refusal renders one line — `<reason> · next: <command>` — where the command is the SAME hop the capsule and the board print (`PipelineFrontier#hopOf` through the shared route renderer), so the engine never names a round another face refuses. The wave gate's prose rows and the doc line's identity prose (`already reviewed at vX …`, `the pending fix applies to the unchanged doc …`) retire from that line. A structure refusal renders `<reason> · <the pre-flight's own wording>` and names no `next:` — a dirty tree or a broken plan graph has no dispatchable round.
- **`NextHop.reason` is the reason table's domain.** The hop's named fact is typed as a table token, so a dispatch verdict carries it without a second spelling.
