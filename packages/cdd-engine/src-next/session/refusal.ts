// packages/cdd-engine/src-next/session/refusal.ts
// P40 T2 — the ONE tree-level refusal fact (design spec §2.1 · §2.2). A work tree
// carries at most one refusal record at any instant, and it lives beside
// `in-flight.json` in the workspace ROOT (`.kairos/cdd/refusal.json`), never inside a
// phase's slug directory: a refusal states "THIS TREE did not pass the pre-dispatch
// gates", which is the tree's fact, not a round's — no round record is written for a
// refused dispatch (§1.2), so the record has no other home.
//
// The class is the twin of `InFlight` (`session/inflight.ts`): one record, one atomic
// write, one state read, and no round state of its own. It judges nothing — the
// pre-flight seam does — and it is not a second history source: a refusal's history is
// the command output (every refusal line names its own station), the rounds' history
// is the ledger's `rounds`, and this record is overwritten by the next refusal and
// cleared once the statement it makes stops holding (§2.2's two expiry triggers).
//
// Publishing order is `InFlight`'s, and it is a precondition rather than a style: a
// refusal is the ONE path that runs before `scene.workspace.ensure()`, so the
// namespace keep-out marker (`.kairos/.gitignore`, one `*`) must land FIRST — without
// it, one refusal becomes the tree's first untracked `.kairos` entry and
// `GitClient#isClean` (which reads git's own judgment, zero engine-side exclusion)
// refuses every later dispatch on the engine's own file.
//
// Two read faces, two questions, ONE class — the split is the point (spec §3.1):
//   · `read()` answers "is this refusal MINE" (the board and the command face, filtered
//     by this workspace's own slug);
//   · `readRaw()` answers "what stands on this TREE" (the release point's clearance —
//     the fact it invalidates is the tree's, so it may not be filtered).
// One method serving both would have to pick one semantic and silently lie to the
// other reader.
//
// Module-level exports are types / the class — zero behavior-carrying bare functions.

import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { AtomicWriter } from "../infra/atomic.ts";
import type { WorkspaceRoot } from "../infra/workspace.ts";
import type { TargetType } from "./faces.ts";
import type { OpType } from "./ledger.ts";
import type { PreFlightGateName } from "./preflight.ts";
import { ArtifactRegistry } from "./round-artifacts.ts";

/** The eight cells of one recorded refusal — the whole fact, with no ninth cell and no
 *  second name for any of them (spec §2.1). */
export interface RefusalFacts {
  /** The instant the record was written (ISO). */
  readonly at: string;
  /** The phase workspace that judged — the slug `read()` filters on. */
  readonly slug: string;
  /** The round verb the refused dispatch would have consumed, already folded
   *  (`branch-review` → `review`) — the same spelling `DispatchIdentity.op` carries. */
  readonly op: OpType;
  /** The target face (the dispatch's `--type` word). */
  readonly type: TargetType;
  /** The cycle the refused dispatch would have consumed. */
  readonly cycle: number;
  /** The attempt the refused dispatch would have consumed. */
  readonly attempt: number;
  /** Which row refused — the structure leg's own row set (nine values, not the four the
   *  judgment produces): every row writes this cell, so the type is the gate-name set. */
  readonly station: PreFlightGateName;
  /** The row's reason as ONE line, never starting with the station word (the station is
   *  already its own cell). The live verdict's continuation lines (`derived:` ·
   *  `found:` · `identity:` · `repair:`) never land here: they describe the work this
   *  refusal did not do, which is not a persistent fact of the tree. */
  readonly detail: string;
}

/** The three states of a judgment-time read of the record — the same tri-state the
 *  in-flight record answers (a corrupt record is never reported as "no record"). */
export type RefusalState =
  | { readonly kind: "absent" }
  | { readonly kind: "corrupt"; readonly reason: string }
  | { readonly kind: "standing"; readonly facts: RefusalFacts };

/**
 * PreFlightRefusal — the tree's ONE refusal record. Constructed with the tree's
 * workspace root and the slug this reader is observing (`read()` answers `absent` for
 * a record another phase workspace wrote; `readRaw()` never compares). Stateless: the
 * record is the state, so two instances over one root agree by construction.
 */
export class PreFlightRefusal {
  /** The record's workspace-relative name — the artifact matrix's `refusal` row, never
   *  a second literal (the matrix is the ONE grammar of a workspace name). */
  static readonly FILE: string = ArtifactRegistry.nameOf("refusal", null);

  readonly #root: WorkspaceRoot;
  /** The observing phase workspace's own name — `read()`'s only use of it. */
  readonly #slug: string;
  /** The ONE atomic write seam (a killed process leaves the previous whole record). */
  readonly #atomic = new AtomicWriter();

  constructor(root: WorkspaceRoot, slug: string) {
    this.#root = root;
    this.#slug = slug;
  }

  /** The record's absolute path. */
  path(): string {
    return path.join(this.#root.path, PreFlightRefusal.FILE);
  }

  /** Publish the namespace keep-out marker, then overwrite the record atomically —
   *  overwrite, never append: one tree holds at most one refusal fact (§2.1). The bytes
   *  carry exactly one trailing newline (the repo's EOF rule). */
  async write(facts: RefusalFacts): Promise<void> {
    this.#root.ensure();
    const record: RefusalFacts = {
      at: facts.at,
      slug: facts.slug,
      op: facts.op,
      type: facts.type,
      cycle: facts.cycle,
      attempt: facts.attempt,
      station: facts.station,
      detail: facts.detail,
    };
    this.#atomic.write(this.path(), `${JSON.stringify(record, null, 2)}\n`);
  }

  /** Remove the record — idempotent (an absent record is not an error). The caller owns
   *  the predicate: this class clears what it is told to clear (§2.2's two expiry
   *  triggers are the writer's and the release point's judgments, not this one's). */
  clear(): void {
    rmSync(this.path(), { force: true });
  }

  /** The record as THIS workspace sees it: a standing record written by another phase
   *  workspace answers `absent` (the board renders the refusal it owns, and its own
   *  board still renders it). Corrupt and absent pass through unchanged — a corrupt
   *  record is a fact about the tree, not about some other slug. */
  read(): RefusalState {
    const state = this.readRaw();
    if (state.kind !== "standing") return state;
    return state.facts.slug === this.#slug ? state : { kind: "absent" };
  }

  /** The record as the TREE holds it — the same three states with zero slug comparison.
   *  The ONE reader is the release point's clearance (the fact that stops holding when a
   *  holder releases is the tree's occupancy, and the record it may have written belongs
   *  to whichever workspace was refused). */
  readRaw(): RefusalState {
    let text: string;
    try {
      text = readFileSync(this.path(), "utf8");
    } catch (raw) {
      const code = (raw as NodeJS.ErrnoException).code;
      return code === "ENOENT"
        ? { kind: "absent" }
        : { kind: "corrupt", reason: "the refusal record is unreadable" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { kind: "corrupt", reason: "the refusal record is not JSON" };
    }
    const facts = PreFlightRefusal.#factsOf(parsed);
    return facts === null
      ? { kind: "corrupt", reason: "the refusal record holds no refusal facts" }
      : { kind: "standing", facts };
  }

  /** The eight cells read off a parsed value, or null when any cell is missing or of the
   *  wrong primitive kind. The closed sets (`op` · `type` · `station`) are carried by the
   *  TYPE, never re-spelled as a second runtime list here — a second list would be the
   *  vocabulary's second home, and the cell would still be a string at read time. */
  static #factsOf(value: unknown): RefusalFacts | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const texts = ["at", "slug", "op", "type", "station", "detail"] as const;
    for (const key of texts) {
      if (typeof record[key] !== "string") return null;
    }
    for (const key of ["cycle", "attempt"] as const) {
      if (typeof record[key] !== "number" || !Number.isFinite(record[key])) return null;
    }
    return {
      at: record.at as string,
      slug: record.slug as string,
      op: record.op as OpType,
      type: record.type as TargetType,
      cycle: record.cycle as number,
      attempt: record.attempt as number,
      station: record.station as PreFlightGateName,
      detail: record.detail as string,
    };
  }
}
