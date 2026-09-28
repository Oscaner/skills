// packages/cdd-engine/src/artifacts/return-block.ts — ReturnBlockParser class (P6 T24 C + Task 7 OOP
// restructure Criterion ②: the return block text plane — parse + serialize + the counters line — is
// ONE instance-method class, zero bare function exports). The four half-implementations (task.ts
// returnFourLines/returnFromHandoff/dryRunReturnBlock + the branch-family dry-run arrays) converge
// here; the parse + serialize atoms live in ONE module. The return block is an engine stdout
// artifact, so it lives in the artifacts layer (the producers — dispatch/task.ts,
// dispatch/branch.ts — import the class instance, never re-defining the `key: value` shapes).
//
//   parse      lastKeyLine / returnFourLines (agent stdout → the three lines)
//   serialize  dryRunBlock / assembleReturnBlock / returnFromHandoff (handoff read-back)
//   counters   returnCountersLine — the UNIQUE construction point of the 4th `counters:` line
//              (field names/labels from rules/failure.ts#counters(), canonical engine-config
//              #failureCategories; missing/corrupt progress.json → 0-fallback, read-only).
//
// May-2026 M3 carrier ruling (cdd-review-contract-fix): the stdout return-block `blocker:` column
// is RETIRED — the agent output contract is three lines (status/commits/artifacts; the engine owns
// the counters line), and a BLOCKED round's reason travels the stderr `CDD_BLOCKED:` single channel
// + the carrier's failure_category. returnFromHandoff's missing/unparseable fallback reason strings
// write to stderr here (never a fabricated blocker default).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { FailureResolver } from "../rules/failure.ts";
import { readJson } from "./handoff/write.ts";

// M3 carrier ruling — the returnFromHandoff fallback branches' reason strings, written to stderr
// through the CDD_BLOCKED single channel (the stdout blocker column is retired, so these reasons
// must never be silently dropped). Module constants so the stderr write and the test assertions
// share one source.
export const HANDOFF_MISSING_REASON =
  "handoff missing after commit-contract interception → re-dispatch task after checking commit-contract errors";
export const HANDOFF_UNPARSEABLE_REASON =
  "handoff JSON unparseable after commit-contract interception → delete the corrupted handoff file and re-dispatch";

/** ReturnBlockParser — the return-block text plane's single face (Criterion ②; constructor injection — the
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

  /** returnFourLines — the agent output contract: picks the last ^key: line from agent stdout for
   * status/commits/artifacts (missing → "<missing>"); the 4th counters line appends via
   * returnCountersLine (engine owns the count — the agent never produces counters). The `blocker:`
   * column is retired (M3) — a stray blocker line in agent stdout is ignored. stdouts +
   * res.returnBlock share this one source. */
  returnFourLines(raw: string, workspace: string): string[] {
    const out = ["status", "commits", "artifacts"].map((key) => this.lastKeyLine(raw, key));
    out.push(this.returnCountersLine(workspace));
    return out;
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
  // blocker (return block and handoff/exit stay consistent).
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

  /** 3-line dry-run return block string (the task dispatch's agentOut: parse face re-appends the
   * counters line via returnFourLines). status/commits/artifacts — the agent output contract (the
   * `blocker:` column is retired, M3). The task dry-run artifacts line is the non-empty
   * brief/report/evidence triple. */
  dryRunBlock(fields: { commits: string; artifacts: string }): string {
    return [
      "status: APPROVED",
      `commits: ${fields.commits}`,
      `artifacts: ${fields.artifacts}`,
    ].join("\n");
  }

  /** The full return block (three fixed lines + the 4th counters line) — the array assembler the
   * black-box stdout producers share (branch-family dry-run blocks; the counters-presence assertion
   * in scripts/validate/smoke-cdd.ts keys on exactly this shape). */
  assembleReturnBlock(
    fields: { status: string; commits: string; artifacts: string },
    workspace: string,
  ): string[] {
    return [
      `status: ${fields.status}`,
      `commits: ${fields.commits}`,
      `artifacts: ${fields.artifacts}`,
      this.returnCountersLine(workspace),
    ];
  }

  /** Aligns _cdd_emit_h1_from_handoff (no jq dependency): reads the handoff JSON; missing/corrupt →
   * BLOCKED fallback. artifacts emitted only when present. T7: the 4th counters line appended via
   * returnCountersLine. M3: the `blocker:` column is retired — a BLOCKED round's reason rides the
   * carrier's failure_category + the stderr CDD_BLOCKED single channel; the missing/unparseable
   * fallback reason strings write to stderr here (never silently dropped with the column). */
  returnFromHandoff(handoffPath: string, workspace: string): string[] {
    if (!handoffPath || !existsSync(handoffPath)) {
      process.stderr.write(`CDD_BLOCKED: ${HANDOFF_MISSING_REASON}\n`);
      return this.returnFourLines("status: BLOCKED", workspace);
    }
    const h = readJson(handoffPath);
    if (!h) {
      process.stderr.write(`CDD_BLOCKED: ${HANDOFF_UNPARSEABLE_REASON}\n`);
      return this.returnFourLines("status: BLOCKED", workspace);
    }
    const commits = (h.commits as Record<string, unknown> | null) ?? {};
    const arts: string[] = [];
    const art = (h.artifacts as Record<string, unknown> | undefined) ?? {};
    for (const key of ["brief", "report", "test_evidence"] as const) {
      if (art[key]) arts.push(`${key}=${String(art[key])}`);
    }
    const out = [
      `status: ${(h.status as string) ?? "BLOCKED"}`,
      `commits: base=${commits.base ?? ""} head=${commits.head ?? ""}`,
    ];
    if (arts.length > 0) out.push(`artifacts: ${arts.join(" ")}`);
    out.push(this.returnCountersLine(workspace));
    return out;
  }

  /** returnCountersLine — the return block `counters` line's UNIQUE construction point (T7): all
   * return block producers append through this method, or the 4-line engine stdout contract
   * (status/commits/artifacts + counters) has no guard.
   * Reads the four counter fields of <workspace>/progress.json: missing / corrupt file / missing
   * keys each fall back to `0` and never throw (a dry-run first round may not have progress.json
   * yet — the fallback IS the first-round shape). **Read-only, no write side effect**: never
   * paper-over the missing-file zero fallback, never overwrites progress.json on the return block path.
   * Field names and counter labels come from failureResolver.counters() (T6 canonical) — zero
   * hand-written counter names / labels here. */
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
