// packages/cdd-engine/src/rules/structure.ts — the StructureRule single interpreter (P3.1 T1 /
// F6; design §2.1 — the unified engine boundary). The ONE structure-judgment face every migrated
// doc assertion consumes: the doc bodies declare their structural demands as rule DATA
// (`structureRules(): StructureRule[]` — the rule-data home at the body root), and THIS module
// interprets any rule set over a document — the same interpreter the T2–T6 rule migrations and the
// T8 gate share. The interpreter is deliberately dependency-free at runtime: its only imports are
// the rule-data type contract from the doc-body root (type-only, erased), re-exported under the
// same names as the produced surface, so the module adds no edge to the eval graph (the tokens.ts
// load-order law: bodies declare rule data lazily, zero interpreter reverse-imports).
//
// Judgment contract (single pass per rule):
//   extractPlaneItems — ONE scan of the content lines per rule, selecting the anchored items by
//                        the rule's plane kind (the anchor regex is the single extraction spec: its
//                        capture group 1 — when present — is the per-item value; presence /
//                        uniqueness / residue judge the item count, domain / crosslink / order /
//                        continuity judge the values). A records rule may scope its scan to a
//                        section via StructurePlane.within (the section-scoped plane — a `##`-run
//                        opened at a heading, or a field run opened at a `- **Steps**:`-style
//                        marker line): a heading-opened run opens at a heading line and closes at
//                        the heading/`---` boundary family (its data-field marker lines are ITEMS,
//                        never closers), a field-opened run closes at the full boundary family
//                        (heading / field marker / `---`). The extraction also carries each run's
//                        item count — the per-run presence judge's surface (presence.perRun).
//   evaluateInvariant — each declared invariant decides against the SAME extracted item list (no
//                       re-parse per invariant; crosslink's target scan is the one second pass,
//                       optionally scoped to a section run by crosslink.targetWithin).
//   Findings          — ONE finding per failing rule: {id, severity, message} — severity maps from
//                       the rule and the message is the rule's declared copy, VERBATIM (the
//                       interpreter never assembles messages: zero runtime concatenation). An empty
//                       rule set (or a rule with zero invariants) judges nothing.
import type {
  StructureFinding,
  StructureInvariant,
  StructurePlane,
  StructureRule,
} from "../documents/doctypes/body/doc-body.ts";

// The produced type surface — the rule-data contract the T2–T8 consumers import from this module
// (the interpreter's type-import + re-export keeps ONE definition home, the body root).
export type {
  StructureFinding,
  StructureInvariant,
  StructurePlane,
  StructureRule,
} from "../documents/doctypes/body/doc-body.ts";

/** One anchored item — the extraction unit the invariants decide against. */
interface PlaneItem {
  /** The anchored content line (headingLeads / records) or the extracted table row (tableRows). */
  line: string;
  /** The item's judged value — the anchor's capture group 1 (trimmed) when present, else "". */
  value: string;
  /** The enclosing within-run's numeric bound — the run opener's capture group 1 (a `### Task N:`
   *  opener captures its number); undefined when the run opener captures no number or the plane is
   *  unscoped (the selfBounded invariant reads it — a bound-less item judges nothing). */
  bound?: number;
}

/** One plane extraction — the item list + the per-run item counts of a within-scoped records scan
 *  (the per-run presence judge's surface; absent for unscoped planes — presence.perRun only makes
 *  sense over within-scoped records runs). */
interface PlaneExtraction {
  /** The anchored items, in content order. */
  items: PlaneItem[];
  /** The per-run item counts of a within-scoped records extraction (each within-run's anchored item
   *  count, in run order) — the presence.perRun judge demands every count > 0. */
  runCounts?: readonly number[];
  /** The maximum numeric within-run bound across the section's runs — the enclosing surface's
   *  id range (a `### Task N:` run family's top task number: ids are 1..maxBound). The selfBounded
   *  exemption reads it — a reference value beyond the range (> maxBound) is the graph plane's
   *  past-the-edge missing-id case, never the anti-dependency contradiction (the plan constraints'
   *  out-of-range exemption mirrored at the doc-contract plane). Absent when no run captured a numeric
   *  bound — the selfBounded judgment then stays range-less and judges every in-run ref. */
  maxBound?: number;
}

/** Compile the anchor source with the scan flags — the `m` line-anchoring (the rule author writes
 *  the `^`-anchored line form; never a global search — extraction is per-line). */
function compile(source: string): RegExp {
  return new RegExp(source, "m");
}

/** A `|-row` whose non-empty cells are all dashes/colons — the structural `|---|---|` separator
 *  face of a table, never a data item (mirrors the deviations-table row scan). */
function isSeparatorRow(row: string): boolean {
  const cells = row
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c !== "");
  return cells.length > 0 && cells.every((c) => /^[-:]+$/.test(c));
}

/** The structural-boundary family that CLOSES a field-opened `within`-scoped records run: a heading
 *  line, a `- **Field**:` marker line (the sibling record plane's field family), or a `---` rule.
 *  The closer itself is never an item; a run left open at the end of the content ends at the last
 *  line. A within-anchor line that ALSO matches the closer is impossible by contract (the run opener
 *  is checked only while OUTSIDE a run — the opener line is consumed by the open, never closed). */
const WITHIN_CLOSE_RE = /^\s*(?:#{1,6}\s|-+\s+\*\*|---+\s*$)/;

/** The boundary family that closes a HEADING-opened within-run (P3.1 T2 fix — the heading-run
 *  plane): a heading line or a `---` rule — the data-field marker lines of a heading-run are ITEMS,
 *  never closers (a `### Task N:` block's `- **Objective**:` lines must count inside the run). The
 *  opener line classifies its run: a line matching this heading family (a `### Task N:` heading)
 *  opens a heading-run; any other opener (a `- **Steps**:` field marker) opens a field-run closed
 *  by the full family above. */
const HEADING_CLOSE_RE = /^\s*(?:#{1,6}\s|---+\s*$)/;

/** The plane's item extraction — ONE line scan per rule: headingLeads / records select the anchored
 *  lines (value = anchor capture group 1, trimmed); tableRows locate each header anchor match then
 *  collect the contiguous `|-rows` below it (the separator row skipped, and data rows that re-match
 *  the anchor are consumed by the run — never re-treated as nested table headers), re-applying the
 *  anchor to each data row for its captured value. A records rule carrying `within` scopes its
 *  items to the runs under a `within`-matching opener line (the section-scoped plane — see
 *  StructurePlane.within): while inside a run the closer family ends it first, then the anchor
 *  selects items; outside a run only the opener line re-enters. The opener LINE classifies its run
 *  (a heading line opens a heading-run closed by the heading/`---` family, its field-marker lines
 *  counted as items; any other opener opens a field-run closed by the full boundary family), and
 *  each run's item count is recorded for the per-run presence judge. A heading-run closed by a
 *  heading line that is also a run opener (the next `### Task N:`) re-enters immediately — the
 *  sequential task blocks never lose their runs. */
function extractPlaneItems(content: string, plane: StructurePlane): PlaneExtraction {
  const lines = content.split("\n");
  const anchor = compile(plane.anchor);
  const items: PlaneItem[] = [];
  if (plane.kind === "headingLeads" || plane.kind === "records") {
    if (plane.within !== undefined) {
      const opener = compile(plane.within);
      const runCounts: number[] = [];
      let inRun = false;
      let fieldCloser = false;
      let runBound: number | undefined;
      let maxBound: number | undefined;
      let runCount = 0;
      for (const line of lines) {
        if (inRun) {
          if ((fieldCloser ? WITHIN_CLOSE_RE : HEADING_CLOSE_RE).test(line)) {
            runCounts.push(runCount);
            inRun = false;
            runCount = 0;
            runBound = undefined;
            // fall through — the closer line may itself be a run opener (the next `### Task N:`)
          } else {
            const m = line.match(anchor);
            if (m) {
              items.push({ line, value: (m[1] ?? "").trim(), bound: runBound });
              runCount++;
            }
            continue;
          }
        }
        if (opener.test(line)) {
          inRun = true;
          runCount = 0;
          fieldCloser = !HEADING_CLOSE_RE.test(line);
          // The run's numeric bound — the opener's captured identifier when present (a `### Task N:`
          // heading captures its task number — the selfBounded judgment's own-number reference; a
          // non-numeric capture leaves the bound undefined → the selfBounded judgment stays vacuous).
          const m = opener.exec(line);
          const captured = m && m[1] !== undefined && m[1] !== "" ? Number(m[1]) : undefined;
          runBound = captured !== undefined && Number.isInteger(captured) ? captured : undefined;
          if (runBound !== undefined)
            maxBound = maxBound === undefined ? runBound : Math.max(maxBound, runBound);
        }
      }
      if (inRun) runCounts.push(runCount);
      return { items, runCounts, maxBound };
    }
    for (const line of lines) {
      const m = line.match(anchor);
      if (m) items.push({ line, value: (m[1] ?? "").trim() });
    }
    return { items };
  }
  for (let i = 0; i < lines.length; i++) {
    if (!anchor.test(lines[i]!)) continue; // no header row here — keep scanning
    // The table's extent: the contiguous `|-row` run under the header (ends at the first line that
    // is not a row); every row in the run is DATA — a row re-matching the anchor is a data cell,
    // never a nested header, so the run is consumed in full before the scan resumes.
    let k = i + 1;
    for (; k < lines.length; k++) {
      if (!/^\s*\|/.test(lines[k]!)) break;
    }
    for (let j = i + 1; j < k; j++) {
      const row = lines[j]!;
      if (isSeparatorRow(row)) continue; // the `|---|---|` face is structural, never an item
      const m = row.match(anchor);
      items.push({ line: row, value: (m?.[1] ?? "").trim() });
    }
    i = k - 1; // continue the scan AFTER the consumed table (a later separate table's header still finds its own run)
  }
  return { items };
}

/** The crosslink target lines — the content's lines restricted to the `targetWithin` section run
 *  when present (the section-scoped target plane): the run opens at a targetWithin-matching line
 *  and closes at the heading/`---` boundary family, so a same-form target row elsewhere in the
 *  document (an Issue-inventory `| P… |` row) can never resolve a Phase-inventory membership ref.
 *  Absent → the whole content (the unscoped target scan). */
function crosslinkTargetLines(content: string, targetWithin: string | undefined): string[] {
  const lines = content.split("\n");
  if (targetWithin === undefined) return lines;
  const opener = compile(targetWithin);
  const scoped: string[] = [];
  let inRun = false;
  for (const line of lines) {
    if (inRun) {
      if (HEADING_CLOSE_RE.test(line)) {
        inRun = false;
        continue;
      }
      scoped.push(line);
      continue;
    }
    if (opener.test(line)) inRun = true;
  }
  return scoped;
}

/** Split a version token into its segment parts — the leading `v`/`V` stripped so numeric segments
 *  (`v10.1` → [10, 1]) compare numerically, never as "v10" < "v2" strings. */
function versionSegments(s: string): readonly (string | number)[] {
  return s.split(/[.-]/).map((part) => {
    const n = Number(part.replace(/^v/i, ""));
    return Number.isFinite(n) ? n : part;
  });
}

/** The order comparator — numeric (default) or segment-aware version ascent. */
function compareValues(a: string, b: string, compare: "numeric" | "version"): number {
  if (compare === "version") {
    const as = versionSegments(a);
    const bs = versionSegments(b);
    const len = Math.max(as.length, bs.length);
    for (let i = 0; i < len; i++) {
      const x = as[i];
      const y = bs[i];
      if (typeof x === "number" && typeof y === "number") {
        if (x !== y) return x < y ? -1 : 1;
      } else {
        const xs = String(x ?? "");
        const ys = String(y ?? "");
        if (xs !== ys) return xs < ys ? -1 : 1;
      }
    }
    return 0;
  }
  const n = Number(a);
  const m = Number(b);
  return n < m ? -1 : n > m ? 1 : 0;
}

/** Decide one invariant against the extracted items. The count-judging invariants (presence /
 *  uniqueness / residue) read the item list; the value-judging ones (domain / crosslink / order /
 *  continuity) read the items' captured values — vacuous over an empty item list (presence owns
 *  the "must exist" demand; presence.perRun owns the per-task-run emptiness demand). */
function evaluateInvariant(
  invariant: StructureInvariant,
  extraction: PlaneExtraction,
  content: string,
): boolean {
  const items = extraction.items;
  switch (invariant.type) {
    case "presence": {
      if (invariant.perRun === true) {
        // Per-run presence — every within-run of the section-scoped records plane must carry at
        // least one anchored item (a `### Task N:` block with zero data-shaped fields fails); a
        // plan with no runs (no task blocks at all) judges nothing — the vacuous true state.
        const counts = extraction.runCounts;
        return counts === undefined || counts.every((n) => n > 0);
      }
      return items.length > 0;
    }
    case "uniqueness":
      return items.length === 1;
    case "domain": {
      if (items.length === 0) return true;
      const valueRe = new RegExp(`^(?:${invariant.valuePattern})$`);
      return items.every((item) => valueRe.test(item.value));
    }
    case "crosslink": {
      if (items.length === 0) return true;
      const targetRe = compile(invariant.targetAnchor);
      const targets = crosslinkTargetLines(content, invariant.targetWithin)
        .map((line) => line.match(targetRe))
        .filter((m) => m !== null) as RegExpMatchArray[];
      // Resolution: some target line's captured value equals the item's ref (dangling = none).
      return items.every((item) =>
        targets.some((m) => {
          const target = (m[1] ?? m[0]).trim();
          return target === item.value;
        }),
      );
    }
    case "order": {
      if (items.length === 0) return true;
      const compare = invariant.compare ?? "numeric";
      for (let i = 1; i < items.length; i++) {
        if (compareValues(items[i]!.value, items[i - 1]!.value, compare) <= 0) return false;
      }
      return true;
    }
    case "continuity": {
      if (items.length === 0) return true;
      const nums = items.map((item) => Number(item.value));
      return nums.every((n, i) => n === i + 1); // the exact 1..N in-order set (gaps/dupes/offset fail)
    }
    case "residue":
      return items.length === 0;
    case "selfBounded": {
      if (items.length === 0) return true;
      // The anti-dependency gate: every comma-split integer ref must be strictly below the
      // enclosing run's OWN number (a ref ≥ the bound — a forward or self reference — fails).
      // Non-integer ref tokens (`none`/empty/`abc`) carry no ref and are skipped (the NaN /
      // integer-gate rejection is the graph plane's); a bound-less run judges nothing (vacuous).
      // A ref value BEYOND the enclosing surface's id range (> the extraction's maxBound — the
      // plan's task range) is exempt: a past-the-edge reference is the graph plane's missing-id
      // class, never the anti-dependency contradiction (the plan constraints' out-of-range exemption).
      const maxN = extraction.maxBound;
      for (const item of items) {
        if (item.bound === undefined) continue;
        for (const token of item.value.split(",")) {
          const t = token.trim();
          if (t === "" || t === "none") continue;
          const n = Number(t);
          if (!Number.isInteger(n)) continue;
          if (maxN !== undefined && n > maxN) continue;
          if (n >= item.bound) return false;
        }
      }
      return true;
    }
  }
}

/** runStructureRules — the single structure interpreter: each rule's plane is extracted once (the
 *  single content pass per rule), its invariants decide against the same extracted item list, and
 *  every rule with a failing invariant emits ONE finding carrying the rule's identity, severity and
 *  fixed message copy. An empty rule set yields zero findings. */
export function runStructureRules(
  content: string,
  rules: readonly StructureRule[],
): StructureFinding[] {
  const findings: StructureFinding[] = [];
  for (const rule of rules) {
    if (rule.invariants.length === 0) continue; // zero demands — nothing to judge
    const extraction = extractPlaneItems(content, rule.plane);
    const failed = !rule.invariants.every((invariant) =>
      evaluateInvariant(invariant, extraction, content),
    );
    if (failed) {
      findings.push({ id: rule.id, severity: rule.severity, message: rule.message });
    }
  }
  return findings;
}
