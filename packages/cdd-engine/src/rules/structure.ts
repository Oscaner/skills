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
//                        continuity judge the values).
//   evaluateInvariant — each declared invariant decides against the SAME extracted item list (no
//                       re-parse per invariant; crosslink's target scan is the one second pass).
//   Findings           — ONE finding per failing rule: {id, severity, message} — severity maps from
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

/** The plane's item extraction — ONE line scan per rule: headingLeads / records select the anchored
 *  lines (value = anchor capture group 1, trimmed); tableRows locate each header anchor match then
 *  collect the contiguous `|-rows` below it (the separator row skipped, and data rows that re-match
 *  the anchor are consumed by the run — never re-treated as nested table headers), re-applying the
 *  anchor to each data row for its captured value. */
function extractPlaneItems(content: string, plane: StructurePlane): PlaneItem[] {
  const lines = content.split("\n");
  const anchor = compile(plane.anchor);
  const items: PlaneItem[] = [];
  if (plane.kind === "headingLeads" || plane.kind === "records") {
    for (const line of lines) {
      const m = line.match(anchor);
      if (m) items.push({ line, value: (m[1] ?? "").trim() });
    }
    return items;
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
  return items;
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
 *  the "must exist" demand). */
function evaluateInvariant(
  invariant: StructureInvariant,
  items: readonly PlaneItem[],
  content: string,
): boolean {
  switch (invariant.type) {
    case "presence":
      return items.length > 0;
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
      const targets = content
        .split("\n")
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
  }
}

/** runStructureRules — the single structure interpreter: each rule's plane is extracted once (the
 *  single content pass per rule), its invariants decide against the same item list, and every rule
 *  with a failing invariant emits ONE finding carrying the rule's identity, severity and fixed
 *  message copy. An empty rule set yields zero findings. */
export function runStructureRules(
  content: string,
  rules: readonly StructureRule[],
): StructureFinding[] {
  const findings: StructureFinding[] = [];
  for (const rule of rules) {
    if (rule.invariants.length === 0) continue; // zero demands — nothing to judge
    const items = extractPlaneItems(content, rule.plane);
    const failed = !rule.invariants.every((invariant) =>
      evaluateInvariant(invariant, items, content),
    );
    if (failed) {
      findings.push({ id: rule.id, severity: rule.severity, message: rule.message });
    }
  }
  return findings;
}
