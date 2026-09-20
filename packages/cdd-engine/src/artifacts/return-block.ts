// packages/cdd-engine/src/artifacts/return-block.ts — the return block text plane's single point
// (P6 T24 C: the four half-implementations — task.ts returnFourLines/returnFromHandoff/
// dryRunReturnBlock + the branch-family dry-run arrays — converge here; the parse + serialize
// atoms live in ONE module). The return block is an engine stdout artifact, so it lives in the
// artifacts layer (the producers — dispatch/task.ts, dispatch/branch.ts — import the atoms, never
// re-defining the `key: value` shapes).
//
//   parse      lastKeyLine / returnFourLines (agent stdout → the four lines)
//   serialize  dryRunBlock / assembleReturnBlock / returnFromHandoff (handoff read-back)
//   counters   returnCountersLine — the UNIQUE construction point of the 5th `counters:` line
//              (field names/labels from rules/failure.ts#counters(), canonical engine-config
//              #failureCategories; missing/corrupt progress.json → 0-fallback, read-only).
//
// Task-23④ real-only blocker default (fake killer): APPROVED / CHANGES_REQUESTED with no declared
// reason → "none" (the success terminal default); BLOCKED with no real reason → "" — never a
// fabricated blocker.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { counters } from "../rules/failure.ts";
import { readJson } from "./handoff/write.ts";

// ---- parse (agent stdout → the four return block lines) ----

/** Last `^key:` line of the agent stdout (missing → "<missing>"). Single parse atom. */
export function lastKeyLine(raw: string, key: string): string {
  const lines = String(raw).split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith(`${key}:`)) return lines[i];
  }
  return `${key}: <missing>`;
}

/** returnFourLines — aligns the legacy bash four-line emitter: picks the last ^key: line from
 * agent stdout; missing → "<missing>". The 5th counters line appends via returnCountersLine
 * (engine owns the count — the agent never produces counters). stdouts + res.returnBlock share
 * this one source. */
export function returnFourLines(raw: string, workspace: string): string[] {
  const out = ["status", "commits", "artifacts", "blocker"].map((key) => lastKeyLine(raw, key));
  out.push(returnCountersLine(workspace));
  return out;
}

// ---- materialization parsers (return block → carrier fields) ----

// Return block `artifacts:` line (key=value whitespace-separated) → artifacts object; missing line
// / empty → {}.
export function artifactsFromReturnLine(line: string | undefined): Record<string, string> {
  const m = String(line).match(/^artifacts:\s*(.*)$/);
  if (!m || !m[1].trim()) return {};
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
export function implementStatusFromReturnLine(line: string | undefined): { status: string; raw: string } {
  const raw = String(line).replace(/^status:\s*/, "").trim();
  return { status: raw === "APPROVED" ? "APPROVED" : "BLOCKED", raw };
}

// Return block `blocker:` line → blocker. Missing line (<missing>) / success default (none) → ""
// (no blocker field lands; returnFromHandoff presents the real-only blocker default at render).
export function returnBlocker(line: string | undefined): string {
  const v = String(line).replace(/^blocker:\s*/, "").trim();
  return v && v !== "<missing>" && v !== "none" ? v : "";
}

// ---- serialize ----

/** Blocker default (Task 23 ④, fake killer): real-only emission — the return-block blocker line
 * carries only real sources. APPROVED / CHANGES_REQUESTED without one → "none" (the success
 * terminal default); BLOCKED with no real reason → "" — never invent a fake blocker. */
export function blockerDefaultFor(status: string | undefined): string {
  return status === "APPROVED" || status === "CHANGES_REQUESTED" ? "none" : "";
}

/** 4-line dry-run return block string (the task dispatch's agentOut: parse face re-appends the
 * counters line via returnFourLines). Always all four lines — the task dry-run artifacts line is
 * the non-empty brief/report/evidence triple. */
export function dryRunBlock(fields: { commits: string; artifacts: string; blocker?: string }): string {
  return [
    "status: APPROVED",
    `commits: ${fields.commits}`,
    `artifacts: ${fields.artifacts}`,
    `blocker: ${fields.blocker ?? "none"}`,
  ].join("\n");
}

/** The full return block (four fixed lines + the 5th counters line) — the array assembler the
 * black-box stdout producers share (branch-family dry-run blocks; the counters-presence assertion
 * in scripts/validate/smoke-cdd.mjs keys on exactly this shape). */
export function assembleReturnBlock(
  fields: { status: string; commits: string; artifacts: string; blocker: string },
  workspace: string,
): string[] {
  return [
    `status: ${fields.status}`,
    `commits: ${fields.commits}`,
    `artifacts: ${fields.artifacts}`,
    `blocker: ${fields.blocker}`,
    returnCountersLine(workspace),
  ];
}

/** Aligns _cdd_emit_h1_from_handoff (no jq dependency): reads the handoff JSON; missing/corrupt →
 * BLOCKED fallback. artifacts emitted only when present. T7: 5th counters line appended via
 * returnCountersLine. */
export function returnFromHandoff(handoffPath: string, workspace: string): string[] {
  if (!handoffPath || !existsSync(handoffPath)) {
    return returnFourLines("status: BLOCKED\nblocker: handoff missing after commit-contract interception → re-dispatch task after checking commit-contract errors", workspace);
  }
  const h = readJson(handoffPath);
  if (!h) {
    return returnFourLines("status: BLOCKED\nblocker: handoff JSON unparseable after commit-contract interception → delete the corrupted handoff file and re-dispatch", workspace);
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
  out.push(`blocker: ${(h.blocker as string) ?? blockerDefaultFor(h.status as string)}`);
  out.push(returnCountersLine(workspace));
  return out;
}

/** returnCountersLine — the return block `counters` line's UNIQUE construction point (T7): all return
 * block producers append through this function, or the task-family 5-line vs branch-family 4-line
 * split has no guard.
 * Reads the four counter fields of <workspace>/progress.json: missing / corrupt file / missing
 * keys each fall back to `0` and never throw (a dry-run first round may not have progress.json
 * yet — the fallback IS the first-round shape). **Read-only, no write side effect**: never
 * paper-over the missing-file zero fallback, never overwrites progress.json on the return block path.
 * Field names and counter labels come from src/rules/failure.ts#counters() (T6 canonical) — zero
 * hand-written counter names / labels here. */
export function returnCountersLine(workspace: string): string {
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
  for (const { field, label } of counters()) {
    parts.push(`${label}=${typeof data[field] === "number" ? data[field] : 0}`);
  }
  return `counters: ${parts.join(" ")}`;
}
