// packages/cdd-engine/src/cli/result-face.ts — the docs-family stdout result face (design §2.9).
// One line the orchestrator can grep / route on without opening the handoff file (defect ① fix):
//
//   status: <status> · blocker: <blocker-count> · handoff: <local-handoff-path>
//
// `<status>` = the handoff's derived status; `<blocker-count>` reuses the canonical Convergence
// single source (rules/convergence.ts#blockerCount — findings with severity "blocker"), never a
// duplicate count; `<path>` = the local handoffPath the consumer wrote/finalized. Callers print the
// face through the exit.ts family (exitOkWith on exit 0), keeping exit.ts the cli layer's single
// exit surface.
import { blockerCount, type HandoffLike } from "../rules/convergence.ts";

export interface DocsResultLike {
  exitCode: number;
  handoff: Record<string, unknown> | null;
}

export function docsResultFace(result: DocsResultLike, handoffPath: string): string {
  const handoff = (result.handoff ?? null) as unknown as HandoffLike | null;
  const status = handoff?.status ?? "";
  const blockers = blockerCount(handoff);
  return `status: ${status} · blocker: ${blockers} · handoff: ${handoffPath}`;
}
