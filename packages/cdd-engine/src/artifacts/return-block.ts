// packages/cdd-engine/src/artifacts/return-block.ts — ReturnBlockParser class (Task 7 OOP
// restructure Criterion ②: the return block text plane — parse + serialize + the counters line — is
// ONE instance-method class, zero bare function exports). The four half-implementations (task.ts
// returnFourLines/returnFromHandoff/dryRunReturnBlock + the branch-family dry-run arrays) converge
// here; the parse + serialize atoms live in ONE module. The return block is an engine artifact, so
// it lives in the artifacts layer (the producers — dispatch/task.ts — import the class instance,
// never re-defining the `key: value` shapes).
//
//   parse       lastKeyLine / returnFourLines (agent stdout → the three lines)
//   serialize   dryRunBlock (the simulated agent's 3-line output)
//   counters    returnCountersLine — the 4th `counters:` line's UNIQUE construction point (field
//               names/labels from rules/failure.ts#counters(), canonical engine-config
//               #failureCategories; missing/corrupt progress.json → 0-fallback, read-only).
//
// T3 (C5 command-contract plane): the ENGINE stdout is now the single status capsule (rules/
// result-face.ts ResultFace) — this module's former engine-emission atoms (assembleReturnBlock /
// returnFromHandoff, the 5-line status/commits/artifacts + counters + next block) are retired; the
// stdout facts (status / blocker / handoff / next) emit through ResultFace only. `returnFourLines`
// survives as the AGENT-output parse carrier feeding implement materialization (its status/commits/
// artifacts indices 0-2 are what finalize.ts reads; the appended counters + next lines are parse-
// plane residue kept for the unit seam). The M3 `blocker:` column stays retired — a BLOCKED round's
// reason travels the stderr `CDD_BLOCKED:` channel + the carrier's failure_category (never a
// fabricated blocker default).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { FailureResolver } from "../rules/failure.ts";

/** ReturnBlockParser — the return block text plane's single face (Criterion ②; constructor injection — the
 *  failure resolver backing the counters line defaults to a fresh instance). Every parse/serialize
 *  atom is an instance method. */
export class ReturnBlockParser {
  readonly #failure: FailureResolver;

  constructor(failure: FailureResolver = new FailureResolver()) {
    this.#failure = failure;
  }

  // ---- parse (agent stdout → the three return block lines) ----

  /** Last `^key:` line of the agent stdout (missing → "<missing>"). Single parse atom. */
  lastKeyLine(raw: string, key: string): string {
    const lines = String(raw).split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith(`${key}:`)) return lines[i];
    }
    return `${key}: <missing>`;
  }

  /** returnFourLines — the agent output contract (the parse carrier feeding implement
   *  materialization): the last ^key: line from agent stdout for status/commits/artifacts (missing →
   *  "<missing>"); the 4th counters line appends via returnCountersLine (the engine owns the count —
   *  the agent never produces counters). The `blocker:` column is retired (M3) — a stray blocker
   *  line in agent stdout is ignored. T3: this is a parse/intermediate shape — the ENGINE stdout
   *  capsule is ResultFace's, never this array. Optional `next` appends the line (the engine's
   *  C5 suggestion — the agent never produces it). */
  returnFourLines(raw: string, workspace: string, next?: string | null): string[] {
    const out = ["status", "commits", "artifacts"].map((key) => this.lastKeyLine(raw, key));
    out.push(this.returnCountersLine(workspace));
    return this.#withNext(out, next);
  }

  // ---- materialization parsers (return block → carrier fields) ----

  // Return block `artifacts:` line (key=value whitespace-separated) → artifacts object; missing line
  // / empty → {}.
  artifactsFromReturnLine(line: string | undefined): Record<string, string> {
    const m = String(line).match(/^artifacts:\s*(.*)$/);
    if (!m?.[1].trim()) return {};
    const artifacts: Record<string, string> = {};
    for (const pair of m[1].trim().split(/\s+/)) {
      const eq = pair.indexOf("=");
      if (eq > 0) artifacts[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    return artifacts;
  }

  // Return block `status:` line → materialized status. The schema accepts only APPROVED/BLOCKED —
  // anything non-APPROVED (NEEDS_CONTEXT / <missing> …) folds to BLOCKED, raw passthrough for the
  // blocker (return block and handoff/exit stay consistent). T3: this fold feeds the CARRIER status;
  // the stdout work axis (COMPLETED spelling) lives in rules/status-deriver.ts#workStatus.
  implementStatusFromReturnLine(line: string | undefined): {
    status: string;
    raw: string;
  } {
    const raw = String(line)
      .replace(/^status:\s*/, "")
      .trim();
    return { status: raw === "APPROVED" ? "APPROVED" : "BLOCKED", raw };
  }

  // Return block `commits:` line (key=value whitespace-separated) → { base?, head? }; missing line /
  // empty → {}. The resume-declared base authorization lane (spec T7.6) reads this — only the
  // `base=` value participates in adoption; the materialization engine stays the authority for the
  // other commits line fields.
  commitsFromReturnLine(line: string | undefined): { base?: string; head?: string } {
    const m = String(line).match(/^commits:\s*(.*)$/);
    if (!m?.[1].trim()) return {};
    const out: { base?: string; head?: string } = {};
    for (const pair of m[1].trim().split(/\s+/)) {
      const eq = pair.indexOf("=");
      if (eq > 0) {
        const key = pair.slice(0, eq);
        const value = pair.slice(eq + 1);
        if (key === "base" || key === "head") (out as Record<string, string>)[key] = value;
      }
    }
    return out;
  }

  // ---- serialize ----

  /** The 3-line dry-run return block string (the task dispatch's simulated AGENT output: the
   *  parse face re-appends the counters line via returnFourLines on the materialization carrier).
   *  status/commits/artifacts — the agent output contract (the `blocker:` column is retired, M3).
   *  The task dry-run artifacts line is the non-empty brief/report/evidence triple. */
  dryRunBlock(fields: { commits: string; artifacts: string }): string {
    return [
      "status: APPROVED",
      `commits: ${fields.commits}`,
      `artifacts: ${fields.artifacts}`,
    ].join("\n");
  }

  #withNext(out: string[], next?: string | null): string[] {
    if (next) out.push(`next: ${next}`);
    return out;
  }

  /** returnCountersLine — the return block `counters` line's UNIQUE construction point (T7): the
   *  parse carrier's 4th line (the engine stdout stopped carrying it in T3 — ResultFace emits the
   *  capsule only; the counters stay readable via progress.json / the `counters` read for
   *  materialization tests).
   *  Reads the four counter fields of <workspace>/progress.json: missing / corrupt file / missing
   *  keys each fall back to `0` and never throw (a dry-run first round may not have progress.json
   *  yet — the fallback IS the first-round shape). **Read-only, no write side effect**: never
   *  paper-over the missing-file zero fallback, never overwrites progress.json on the return block path.
   *  Field names and counter labels come from failureResolver.counters() (T6 canonical) — zero
   *  hand-written counter names / labels here. */
  returnCountersLine(workspace: string): string {
    const jsonPath = path.join(workspace, "progress.json");
    let data: Record<string, unknown> = {};
    if (existsSync(jsonPath)) {
      try {
        data = JSON.parse(readFileSync(jsonPath, "utf8")) as Record<string, unknown>;
      } catch {
        data = {};
      }
    }
    const parts = [];
    for (const { field, label } of this.#failure.counters()) {
      parts.push(`${label}=${typeof data[field] === "number" ? data[field] : 0}`);
    }
    return `counters: ${parts.join(" ")}`;
  }
}
