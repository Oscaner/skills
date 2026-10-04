// packages/cdd-engine/src/documents/doctypes/overall.ts — the OverallDocType subclass (P1 T2; plan
// §T2 · design C1: the overall doc type — the chain root). The canonical four-table parse
// (parseOverall) and the overall contract + four-table audit (validateOverallContract ← the
// DocumentsValidator's per-type branch) home here as the doc type's parse / validate surfaces; the
// audit's claim-extraction and plan-cell equivalence atoms live in the shared doctype layer
// (./shared.ts). The overall is the chain root: parentChain yields the entry itself and the route
// surface carries null across (no routed review/fix face — S4). SplitCells/sectionRange-style table
// atoms stay module-private (single-type atoms stay in their own file), exactly one consumer.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type DocContext, DocType, type DocValidateFailure } from "../doctype.ts";
import { DOC_TOKENS, escapeRegExp } from "../tokens.ts";
import { DOC_WORDS } from "../words.ts";
import { OVERALL_BODY_VIEW } from "./body-views.ts";
import { OVERALL_SHAPE } from "./shapes/overall.ts";
import {
  type ClaimDeclarationTrace,
  dottedLegalHint,
  extractClaimRows,
  type HistoryRow,
  isOwnPlanDocName,
  isPendingText,
  isShippedColumn,
  mismatchDiagnosticHint,
  ownDesignToken,
  planCellMatchesClaim,
  stripCellMarkup,
} from "./shared.ts";

// ---- four-table audit + parse tokens (canonical — documents/tokens.ts) ----
const HEADER_RE = DOC_TOKENS.phaseHeaderRe;
const CANONICAL_COL_TOKEN = DOC_TOKENS.canonicalColumnRe;
const CHANGE_HISTORY_SECTION_RE = DOC_TOKENS.changeHistoryHeadingRe;
const PHASE_ROW_OPEN_RE = DOC_TOKENS.phaseRowOpenRe;
const PHASE_ROW_CELL_COUNT = DOC_TOKENS.phaseRowCellCount;
const VERSION_CELL_NUMERIC_RE = DOC_TOKENS.versionNumericRe;
const DEPENDENCY_GRAPH_HEADING_RE = DOC_TOKENS.dependencyGraphHeadingRe;
const ISSUE_ANCHOR_RE = DOC_TOKENS.issueAnchorFormRe;
const PHASE_TOKEN_RE = DOC_TOKENS.phaseTokenScanRe;
const VERSION_HEADER_RE = DOC_TOKENS.versionHeaderRe;
const HISTORY_VERSION_CELL_RE = DOC_TOKENS.historyVersionCellRe;
const DESIGN_DOC_SUFFIX = DOC_TOKENS.designDocTail;

// ---- table parse atoms (module-private — one consumer: the overall parse) ----

// Split a table row into cells on unescaped `|` (a `\|` inside a cell stays a literal pipe).
function splitCells(t: string): string[] {
  const cells: string[] = [];
  let buf = "";
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\\" && t[i + 1] === "|") {
      buf += "|";
      i++;
    } else if (t[i] === "|" && t[i - 1] !== "\\") {
      cells.push(buf.trim());
      buf = "";
    } else {
      buf += t[i];
    }
  }
  cells.push(buf.trim());
  return cells;
}

function sectionRange(lines: string[], headingRe: RegExp): { start: number; end: number } | null {
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function tableRows(lines: string[], range: { start: number; end: number }): string[][] {
  const rows: string[][] = [];
  for (let i = range.start + 1; i < range.end; i++) {
    const t = lines[i].trim();
    if (t.startsWith("|") && t.endsWith("|")) rows.push(splitCells(t));
  }
  return rows;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.slice(1, -1).every((c) => c !== "" && /^-+$/.test(c));
}

// Version lineage of the parent overall: its current `**Version:**` header ∪ change-history
// version cells — the file itself is the source of truth (frozen docs legitimately pin the version
// in force at authoring time; fabricated / future tokens fail).
function overallTokenVersions(filePath: string): string[] {
  const raw = readFileSync(filePath, "utf8");
  const versions = new Set<string>();
  const cur = raw.match(VERSION_HEADER_RE);
  if (cur) versions.add(cur[1]);
  for (const line of raw.split("\n")) {
    const m = line.match(HISTORY_VERSION_CELL_RE);
    if (m) versions.add(m[1]);
  }
  return [...versions];
}

/** A Phase-inventory row's parsed cell face — design / plan / dependency positions read over the
 *  canonical 8-cell row shape (never keyed by column names). */
export interface PhaseRow {
  id: string;
  design: string;
  plan: string;
  dependency: string;
}

interface IssueRow {
  phase: string;
  ref: string;
}

/** The canonical four-table parse result (single source — the overall contract + four-table audit
 *  and the closeout mismatch surface consume the same parse, never a second one). */
export interface OverallParse {
  kernelOk: boolean; // readable AND canonical Phase inventory header
  reason: string; // unreadable / missing header / non-canonical
  ids: string[];
  dupIds: string[]; // phase ids registered more than once (④ registration incompleteness)
  rows: PhaseRow[]; // Phase-inventory cell rows (design/plan/dependency — the audit's column face)
  issues: IssueRow[];
  graphTokens: string[];
  historyRows: HistoryRow[];
  shapeDrift: Array<{ id: string; cells: number; expected: number }>;
  versionProblems: string[];
}

/** The overall doc type — the chain root (parentChain = itself). Detection: the `-overall.md`
 *  filename form ∨ the Phase-inventory header-open line (`| # | Phase |` — the four-table feature,
 *  spec C2). Parse: the canonical four-table parse. Validate: the overall contract face (kernel
 *  row-shape + version lineage) + the four-table audit faces ①-⑥.
 */
export class OverallDocType extends DocType {
  constructor() {
    super({
      kind: "overall",
      // Shape domain — the overall output schema content (T3: the concrete per-type shape, the
      // SchemaFactory's projection source). Words — the shared engine lexicon content (T4: every
      // doc type references the same DOC_WORDS object — words single-source). BodyView — the chain
      // root carries no body forms (T5: zero discriminating formats, no review face). instructions /
      // refKind stay the P1 placeholder state (P5 lands the concrete content).
      shape: OVERALL_SHAPE,
      words: DOC_WORDS,
      instructions: [],
      refKind: { kind: "" },
      bodyView: OVERALL_BODY_VIEW,
      // The overall is the chain root — no routed review/fix face (S4): null across the surface.
      route: { reviewType: null, argKey: null, targetFlag: null },
    });
  }

  /** Overall detection: the `-overall.md` basename form ∨ a Phase-inventory header-open line
   *  (`| # | Phase |` — the four-table feature). The fallback scan order (overall → plan → spec)
   *  asks this type first. */
  detect(fileName: string, content: string): boolean {
    if (fileName.endsWith("-overall.md")) return true;
    return content.split("\n").some((l) => HEADER_RE.test(l));
  }

  /** The canonical four-table parse — the single source the audit and the closeout mismatch
   *  surface consume. The overall parse reads the FILE ONLY — the DocContext is never consumed
   *  (the chain root carries no phase-id/pin tokens), so the abstract surface discards ctx and
   *  defers to the ctx-free parseOverall. */
  parse(entry: string, _ctx: DocContext): OverallParse {
    return this.parseOverall(entry);
  }

  /** The overall contract face — kernel + row-shape + change-history rules + merged version
   *  lineage + the four-table audit (faces ①-⑥). phaseId (four-table face ④ — a phase-less audit
   *  skips the registration check) and pinnedTokens (the merged version-lineage face) ride the
   *  doc context, carried by the plan/spec chain. */
  validate(entry: string, ctx: DocContext): DocValidateFailure[] {
    return this.validateOverallContract(entry, ctx.phaseId ?? null, ctx.pinnedTokens ?? []);
  }

  /** No routed review/fix lifecycle face — the overall is the chain root (S4), the lifecycle
   *  dispatch key is null. */
  lifecycle(_entry: string, _ctx: DocContext): unknown {
    return this.route.reviewType;
  }

  /** The chain root — the overall resolves to ITSELF (the S3 parent-chain walk terminates here).
   */
  parentChain(entry: string, _root: string): string | null {
    return entry;
  }

  /** overall contract: canonical header · row-shape guard · change-history ascending/unique/dates —
   *  plus the merged version-lineage (the chain's pinned vX.Y tokens ∈ the overall's lineage,
   *  canonical change-history version rules carry over) — plus the four-table audit faces ①-⑥.
   *  A phase-less plan (phaseId null) skips ④'s dispatch-phase registration; the structural faces
   *  still run fully. */
  validateOverallContract(
    overallPath: string,
    phaseId: string | null,
    pinnedTokens: readonly string[] = [],
  ): DocValidateFailure[] {
    const failures: DocValidateFailure[] = [];
    const o = this.parseOverall(overallPath);
    if (!o.kernelOk) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "Phase inventory",
        missing: o.reason,
        fix: o.reason.includes("non-canonical")
          ? `add the \`${DOC_TOKENS.canonicalColumn}\` column to the Phase inventory header (the canonical-form marker the engine keys on; the \`| # | Phase |\` header open must stay)`
          : "make sure the overall file exists and carries a canonical Phase inventory table",
      });
      return failures;
    }
    for (const d of o.shapeDrift) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "row-shape drift",
        missing: `${d.id}: ${d.cells} cells ≠ file norm ${d.expected}`,
        fix: "re-merge split/extra cells so every Phase-inventory `| P… |` row carries the same column count",
      });
    }
    for (const p of o.versionProblems) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "Change history",
        missing: p,
        fix: "format change-history rows as strictly ascending unique `v<major>.<minor>` versions with non-empty dates",
      });
    }
    // Merged version-lineage: the dispatch chain's OWN pinned vX.Y must be a version the overall
    // carries (its current `**Version:**` ∪ change-history cells) — the canonical change-history
    // version rules are the lineage source (single implementation; a fabricated/future pin fails).
    if (pinnedTokens.length > 0) {
      const lineage = new Set(overallTokenVersions(overallPath));
      for (const tok of pinnedTokens) {
        if (!lineage.has(tok)) {
          failures.push({
            artifact: "overall",
            file: overallPath,
            field: "Version lineage",
            missing: `pinned version token ${tok} ∉ overall lineage {${[...lineage].join(", ")}}`,
            fix: `pin the Parent program line to a version the overall actually carries (its \`${DOC_TOKENS.versionMark}:\` header or a change-history row)`,
          });
        }
      }
    }
    failures.push(...this.#fourTableAudit(o, overallPath, phaseId));
    return failures;
  }

  /** Program slug for the doc-existence globs and the anchor scan: the overall filename's feature
   *  slug (date prefix + `-overall` suffix stripped) — the program identity, not a phase id. */
  fileNameSlug(overallPath: string): string {
    const base = path.basename(overallPath).replace(/\.md$/, "");
    return base.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-overall$/, "");
  }

  /** Directory listing for the same-slug doc globs (the anchor scan + document-existence faces). */
  mdNames(dir: string): string[] {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  }

  // ---- the canonical four-table parse (parseOverall semantics) ----

  /** The ctx-free four-table parse surface — takes the overall path alone. The overall parse never
   *  consumes a DocContext (the chain root carries no phase-id/pin tokens — no context exists to
   *  synthesize), so callers without one — the facade's parseOverall delegation — use this surface
   *  directly instead of fabricating a `{ root }` literal. */
  parseOverall(overallPath: string): OverallParse {
    const out: OverallParse = {
      kernelOk: false,
      reason: "",
      ids: [],
      dupIds: [],
      rows: [],
      issues: [],
      graphTokens: [],
      historyRows: [],
      shapeDrift: [],
      versionProblems: [],
    };
    let raw: string;
    try {
      raw = readFileSync(overallPath, "utf8");
    } catch {
      out.reason = `overall file unreadable (${overallPath})`;
      return out;
    }
    const lines = raw.split("\n");
    const headerIdx = lines.findIndex((l) => HEADER_RE.test(l));
    if (headerIdx === -1) {
      out.reason = "no Phase inventory header";
      return out;
    }
    if (!CANONICAL_COL_TOKEN.test(lines[headerIdx])) {
      out.reason = "non-canonical Phase inventory header (no Implementation plan column)";
      return out;
    }
    out.kernelOk = true;

    // Phase-inventory rows: `| P… | … |` with the canonical 6-content-column form (= 8 split
    // tokens). Row-shape guard: every row must carry the file-norm cell count — a stray merged/split
    // cell shifts design/plan/dependency by a column and only detonates at closeout value-population,
    // so it is caught here at parse time (same semantics as the validate guard).
    let norm = 0;
    const seenLower = new Set<string>();
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (/^## /.test(t)) break;
      if (PHASE_ROW_OPEN_RE.test(t) && t.endsWith("|")) {
        const c = splitCells(t);
        if (c.length >= PHASE_ROW_CELL_COUNT) {
          if (norm === 0) norm = c.length;
          else if (c.length !== norm) {
            out.shapeDrift.push({
              id: c[1]?.trim() || "(unnamed)",
              cells: c.length,
              expected: norm,
            });
            continue; // a misaligned row's cells are untrustworthy — skip id collection
          }
          const id = c[1]?.trim() || "";
          // Duplicate registration (④): the inventory is the single phase-identity authority — the
          // same id registering twice is an incomplete registration, not two phases.
          if (id && !seenLower.has(id.toLowerCase())) {
            seenLower.add(id.toLowerCase());
            out.ids.push(id);
            out.rows.push({ id, design: c[3] ?? "", plan: c[4] ?? "", dependency: c[6] ?? "" });
          } else if (id) {
            out.dupIds.push(id);
          }
        }
      }
    }

    // Issue inventory (⑥ / ⑤ faces) — `| Phase | Issue (ref) | … |`.
    const issueRange = sectionRange(
      lines,
      new RegExp(`^${escapeRegExp(DOC_TOKENS.issueInventoryHeading)}`),
    );
    if (issueRange) {
      for (const c of tableRows(lines, issueRange)) {
        if (isSeparatorRow(c) || c[1]?.trim().toLowerCase() === "phase") continue;
        out.issues.push({ phase: c[1] ?? "", ref: c[2] ?? "" });
      }
    }

    // Dependency graph (③ face): the ASCII fence's `P<n>` tokens (the graph rows may carry inline
    // annotations after the edges — the token scan reads the whole fenced block).
    const graphRange = sectionRange(lines, DEPENDENCY_GRAPH_HEADING_RE);
    if (graphRange) {
      const tokens = new Set<string>();
      let inBlock = false;
      for (let i = graphRange.start + 1; i < graphRange.end; i++) {
        const t = lines[i].trim();
        if (t.startsWith("```")) {
          if (inBlock) break;
          inBlock = true;
          continue;
        }
        if (inBlock) for (const m of t.matchAll(PHASE_TOKEN_RE)) tokens.add(m[0]);
      }
      out.graphTokens = [...tokens];
    }

    // Change-history rows (① claims + the kernel ③ ascending/unique/date rules).
    const range = sectionRange(lines, CHANGE_HISTORY_SECTION_RE);
    if (range) {
      const seen = new Set<string>();
      let prev: [number, number] | null = null;
      for (const c of tableRows(lines, range)) {
        if (isSeparatorRow(c) || c[1]?.trim().toLowerCase() === "version") continue;
        const m = (c[1] ?? "").match(VERSION_CELL_NUMERIC_RE);
        let version: [number, number] | null = null;
        if (!m) {
          out.versionProblems.push(
            `bad/empty version: ${JSON.stringify(c[1])} — should look like: \`| v1.0 | <date> | <summary> |\` (the first content cell must carry the \`v<major>.<minor>\` token)`,
          );
        } else {
          version = [+m[1], +m[2]];
          if (!(c[2] ?? "").trim())
            out.versionProblems.push(`version v${m[1]}.${m[2]} has an empty date`);
          const key = `${m[1]}.${m[2]}`;
          if (seen.has(key)) out.versionProblems.push(`duplicate version v${key}`);
          seen.add(key);
          if (prev && (version[0] < prev[0] || (version[0] === prev[0] && version[1] <= prev[1]))) {
            out.versionProblems.push(
              `not ascending: v${prev[0]}.${prev[1]} → v${version[0]}.${version[1]}`,
            );
          }
          prev = version;
        }
        out.historyRows.push({ version, date: c[2] ?? "", summary: c[3] ?? "" });
      }
    }
    return out;
  }

  // ---- the four-table audit (faces ①-⑥) on the resolved parent overall ----

  /** The anchor-registry scan surface: the overall itself + every same-slug phase document under the
   *  specs/ and plans/ directories (bounded readdirSync, never a full-tree find). */
  #anchorScanFiles(overallPath: string): string[] {
    const files = [overallPath];
    const slug = this.fileNameSlug(overallPath);
    // same-slug phase docs — canonical ids in their filename form (dot segments included: a
    // `…-p2.1-design.md` doc is scanned like its base `…-p1-design.md` sibling)
    const re = new RegExp(`-${slug}-p\\d+(?:\\.\\d+)*(?:-design|-plan)?\\.md$`);
    const specsDir = path.dirname(overallPath);
    const plansDir = path.join(specsDir, "..", "plans");
    for (const dir of [specsDir, plansDir]) {
      for (const n of this.mdNames(dir)) if (re.test(n)) files.push(path.join(dir, n));
    }
    return files;
  }

  /** ①-⑥ four-table audit on the resolved parent overall. Every face surfaces guidance-shaped
   *  failures; faces with nothing to audit (no anchors / no claims / no graph / no issue rows) no-op. */
  #fourTableAudit(
    o: OverallParse,
    overallPath: string,
    phaseId: string | null,
  ): DocValidateFailure[] {
    const failures: DocValidateFailure[] = [];
    const idsLower = new Set(o.ids.map((id) => id.toLowerCase()));
    const byIdLower = new Map(o.rows.map((r) => [r.id.toLowerCase(), r]));
    const slug = this.fileNameSlug(overallPath);

    // ④ phase-registration completeness — the dispatch phase ∈ inventory ids (the Class-B old
    // sub-check migrated here: identity resolves through the inventory, never basename enumeration)
    // + duplicate rows are an incomplete registration. Single implementation (the old spec-side
    // duplicate is gone).
    for (const dup of o.dupIds) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "Phase inventory",
        missing: `duplicate phase registration: ${dup} appears more than once in the Phase inventory`,
        fix: "keep each phase id in exactly one Phase-inventory row (merge the split rows)",
      });
    }
    if (phaseId && !idsLower.has(phaseId.toLowerCase())) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "Phase inventory",
        missing: `phase ${phaseId} not registered in the parent overall Phase inventory`,
        fix: `register phase ${phaseId} in the parent overall's Phase inventory`,
      });
    }

    // ⑥ Issue-inventory rows well-formed: phase ∈ ids + a recognizable ref form (anchored `#NNN#…`,
    // bare `#NNN`, wrapped `[#NNN](…)`, `none`, or a parenthetical note).
    for (const r of o.issues) {
      if (!idsLower.has(r.phase.trim().toLowerCase())) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "Issue inventory",
          missing: `issue row phase ${JSON.stringify(r.phase)} is not a Phase-inventory id — should look like: \`P1\`, \`P2.1\` (a canonical \`P<digits>(.digits)*\` id registered in the Phase inventory)`,
          fix: "set the Issue-inventory Phase column to a registered phase id (or fix the row alignment)",
        });
        continue;
      }
      const refTxt = (r.ref ?? "").trim();
      if (refTxt === "none") continue;
      if (/#issuecomment-/.test(refTxt)) {
        if (/#issuecomment-\d+/.test(refTxt)) continue;
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "Issue inventory",
          missing: `malformed anchor ref (issue-ref #issuecomment- followed by non-digits): ${refTxt}`,
          fix: "use the anchored form `#NNN#issuecomment-<digits>` or the literal `none`",
        });
        continue;
      }
      if (/^#\d+(?![\w])/.test(refTxt)) continue;
      if (/^\[\s*#\d+\s*\]/.test(refTxt)) continue;
      if (/^[（(][^）)]*[）)]$/.test(refTxt)) continue;
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "Issue inventory",
        missing: `unrecognized issue ref: ${refTxt} — should look like: \`none\`, \`#123\`, \`[#123]\`, \`#123#issuecomment-456\`, or a whole-cell parenthetical note`,
        fix: "use the anchored form `#NNN#issuecomment-<digits>`, a bare/wrapped `#NNN`, the literal `none`, or a parenthetical note",
      });
    }

    // ⑤ anchor registration domain: every `#NNN#issuecomment-<digits>` anchor across the program
    // docs must reference an issue number registered in the Issue inventory. No anchors → no-op.
    const registered = new Set<string>();
    for (const r of o.issues) {
      for (const m of (r.ref ?? "").matchAll(/#(\d+)/g)) registered.add(m[1]);
    }
    for (const file of this.#anchorScanFiles(overallPath)) {
      let raw: string;
      try {
        raw = readFileSync(file, "utf8");
      } catch {
        continue; // unreadable doc → nothing to scan (fail-open)
      }
      for (const m of raw.matchAll(ISSUE_ANCHOR_RE)) {
        if (!registered.has(m[1])) {
          failures.push({
            artifact: "overall",
            file,
            field: "Anchor registry",
            missing: `anchor issue #${m[1]} not registered in the Issue inventory`,
            fix: "register the issue as a row in the overall's Issue inventory (anchored form `#NNN#issuecomment-<digits>`) or drop the anchor",
          });
        }
      }
    }

    // ③ dependency-graph membership: every graph token AND every Phase-inventory Dependency-cell
    // predecessor must exist in the Phase inventory.
    for (const tok of o.graphTokens) {
      if (!idsLower.has(tok.toLowerCase())) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "Dependency graph",
          missing: `dependency graph references ${tok}, which is not in the Phase inventory (dangling graph token)`,
          fix: "add a Phase-inventory row for the phase or fix the graph reference",
        });
      }
    }
    for (const r of o.rows) {
      for (const m of (r.dependency ?? "").matchAll(PHASE_TOKEN_RE)) {
        if (!idsLower.has(m[0].toLowerCase())) {
          failures.push({
            artifact: "overall",
            file: overallPath,
            field: "Dependency graph",
            missing: `phase ${r.id} dependency column cites ${m[0]}, which is not in the Phase inventory`,
            fix: "add the predecessor to the Phase inventory or fix the dependency cell",
          });
        }
      }
    }

    // ② document-existence glob: a non-pending plan column needs its plan doc (bare `*-<slug>-p<N>.md`
    // OR the `-plan` variant), a design cell with its own `P<N>-design` token needs the design doc.
    const specsDir = path.dirname(overallPath);
    const plansDir = path.join(specsDir, "..", "plans");
    const plansHit = (id: string) => {
      return this.mdNames(plansDir).filter((n) => isOwnPlanDocName(n, slug, id));
    };
    const designHit = (id: string) => {
      return this.mdNames(specsDir).filter((n) =>
        n.endsWith(`-${slug}-${id.toLowerCase()}${DESIGN_DOC_SUFFIX}`),
      );
    };
    for (const r of o.rows) {
      if (!isPendingText(r.plan)) {
        const hits = plansHit(r.id);
        if (hits.length === 0) {
          failures.push({
            artifact: "overall",
            file: overallPath,
            field: "Document existence",
            missing: `missing plan doc: ${r.id} Implementation plan column is non-pending but no doc matches *-${slug}-${r.id.toLowerCase()}.md / *-${slug}-${r.id.toLowerCase()}-plan.md`,
            fix: "write the phase plan under the program slug (or set the column back to `[Pending]`)",
          });
        } else if (hits.length > 1) {
          failures.push({
            artifact: "overall",
            file: overallPath,
            field: "Document existence",
            missing: `${r.id} plan doc duplicate (both plan forms exist): ${hits.join(", ")}`,
            fix: "keep exactly one plan doc form per shipped phase",
          });
        }
      }
      const own = ownDesignToken(r.design, r.id);
      if (own) {
        const hits = designHit(r.id);
        if (hits.length === 0) {
          failures.push({
            artifact: "overall",
            file: overallPath,
            field: "Document existence",
            missing: `missing design doc: ${r.id} Design spec column carries ${own} but no doc matches *-${slug}-${r.id.toLowerCase()}-design.md`,
            fix: "write the phase design doc under the program slug (or remove the design token)",
          });
        } else if (hits.length > 1) {
          failures.push({
            artifact: "overall",
            file: overallPath,
            field: "Document existence",
            missing: `${r.id} design doc duplicate: ${hits.join(", ")}`,
            fix: "keep exactly one design doc per phase",
          });
        }
      }
    }

    // ① bidirectional backfill claim ↔ column: forward (claim ⇒ column carries the target) + reverse
    // (a shipped column ⇒ a matching claim exists) for plan + design — no plan-only leftover.
    const { planClaims, designClaims, proseHints, illegalPhaseRefs, traces } = extractClaimRows(
      o.historyRows,
    );
    // C2 ⑧ — per-lane trace lookup: the diagnostic trio assembles each forward-mismatch failure's
    // fault context (claiming clause · parsed phase · mechanism · ⑥ expanded list) from the trace.
    const planTrace = new Map<string, ClaimDeclarationTrace>();
    const designTrace = new Map<string, ClaimDeclarationTrace>();
    for (const t of traces) (t.lane === "plan" ? planTrace : designTrace).set(t.pid, t);
    // C2 ⑦⑧ — an illegal phase-id found in a declared claim slot is a strict grammar-A violation
    // (letter-suffixed refs like `P3.10a` are never swallowed into their numeric parent). The parse
    // phase slot already stopped at the error state; the failure carries the diagnostic trio:
    // (1) fault context (clause excerpt · the vacant parse phase slot · the strict-grammar mechanism),
    // (2) syntax-class category dispatch (the legal dotted phase-id shape + the table location),
    // (3) the executable rename action.
    for (const r of illegalPhaseRefs) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "phase-id syntax",
        missing: `change-history claim clause ${JSON.stringify(r.clause)} (row ${r.row}) references illegal phase-id ${JSON.stringify(r.token)} — parse mechanism: letter-suffixed phase-id → grammar-A violation; the parse phase slot stops at the error state, no phase is attributed`,
        fix: `category: syntax — the legal phase-id shape is dotted (${dottedLegalHint(r.token)}); locate the ref in the change-history summary cell of row ${r.row} — action: rename ${r.token} → ${dottedLegalHint(r.token)}, then re-run the audit`,
      });
    }
    for (const [pid, key] of planClaims) {
      const r = byIdLower.get(pid.toLowerCase());
      if (!r) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "backfill claim",
          missing: `change-history claim references ${pid}, which is not in the Phase inventory`,
          fix: "fix the claim's phase reference to a registered phase id",
        });
        continue;
      }
      // Link-form cells satisfy the claim via own-document href identity; `[In-flight]` is never a
      // mismatch; a pending cell or a mismatched `Done`-style cell fails (planCellMatchesClaim).
      if (!planCellMatchesClaim(r.plan, r.id, key, slug)) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "backfill claim",
          missing: `${pid} Implementation plan column ${JSON.stringify(stripCellMarkup(r.plan))} ≠ claim target ${key}${planTrace.has(pid) ? mismatchDiagnosticHint(planTrace.get(pid)!, proseHints.get(pid) ?? []) : ""}`,
          fix: `action: backfill the plan column to the claimed value — a \`Done\`-style completion marker or a link to the phase's own plan doc (or correct the claim)`,
        });
      }
    }
    for (const [pid, key] of designClaims) {
      const r = byIdLower.get(pid.toLowerCase());
      if (!r) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "backfill claim",
          missing: `change-history claim references ${pid}, which is not in the Phase inventory`,
          fix: "fix the claim's phase reference to a registered phase id",
        });
        continue;
      }
      const own = ownDesignToken(r.design, pid);
      if (!own || own.toLowerCase() !== key.toLowerCase()) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "backfill claim",
          missing: `${pid} Design spec column needs its own ${key} token (got ${JSON.stringify(stripCellMarkup(r.design))})${designTrace.has(pid) ? mismatchDiagnosticHint(designTrace.get(pid)!, proseHints.get(pid) ?? []) : ""}`,
          fix: `action: backfill the Design spec column to carry the claimed design token (or correct the claim)`,
        });
      }
    }
    // Reverse members on the same bidirectional rule: a SHIPPED column (plan `Done`-style or a
    // link-cell / design carrying its own `P<n>-design` token) requires a matching claim in the
    // change history — `[In-flight]` plan cells are carved out (an in-flight cell owes no closeout claim).
    for (const r of o.rows) {
      if (!isShippedColumn(r.plan)) continue;
      if (!planClaims.has(r.id)) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "backfill claim",
          missing: `${r.id} Implementation plan column has shipped but the change history carries no matching plan claim`,
          fix: "add a change-history backfill claim (plan-link clause with `Pending → <target>`) for the shipped phase",
        });
      }
    }
    for (const r of o.rows) {
      const own = ownDesignToken(r.design, r.id);
      if (!own) continue;
      if (!designClaims.has(r.id)) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "backfill claim",
          missing: `${r.id} Design spec column carries its own token but change history has no matching design claim`,
          fix: "add a change-history backfill claim (Design-spec link clause with `Pending → <target>`) for the shipped design",
        });
      }
    }
    return failures;
  }
}
