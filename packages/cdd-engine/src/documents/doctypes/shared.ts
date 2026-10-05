// packages/cdd-engine/src/documents/doctypes/shared.ts — the cross-type parse/claim atoms shared by
// the concrete doc types (P1 T2; plan §T2 · design C1). The per-type contract/parse logic homes in
// the three subclass files (overall.ts / plan.ts / phase-spec.ts); the atoms MORE THAN ONE type (or
// the DocumentsValidator facade) consume live here. "Cross-type common helpers stay module-private"
// — this module is private to the doctypes layer — nothing re-exports it through the registry /
// doctype public face, and a single-type atom stays module-private in its own type's file. The
// claim family / plan-cell equivalence / link-target resolution that used to sit in
// rules/documents.ts converge here so the subclass methods never reach back into the rules plane.

import { statSync } from "node:fs";
import path from "node:path";
import { DOC_TOKENS, escapeRegExp } from "../tokens.ts";

// ---- link / target resolution (generic markdown parse atoms — engine-local, no schema leaf) ----

/** A generic markdown link atom — `[label](target)`, negative-lookbehind excludes images. */
const LINK_RE = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;

export function linksOnLine(line: string): Array<{ label: string; target: string }> {
  const out: Array<{ label: string; target: string }> = [];
  for (const m of line.matchAll(LINK_RE)) out.push({ label: m[1], target: m[2] });
  return out;
}

/** Scheme links, local anchors, absolute-root paths, dir refs and template tokens are prose, not
 *  tree paths (the same target-class predicate as plan-spec-anchors). */
export function isPlaceholderOrTemplateTarget(t: string): boolean {
  if (!t) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^mailto:/i.test(t)) return true;
  if (t.startsWith("#") || t.startsWith("/")) return true;
  if (t === "." || t === ".." || t.endsWith("/")) return true;
  if (/^url$/i.test(t)) return true;
  if (/[\s<>…?|*{}[\]()`"'（）]/.test(t)) return true;
  return false;
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolveFromBase(root: string, target: string): string | null {
  const abs = path.join(root, target.split("#")[0]);
  return isFile(abs) ? abs : null;
}

export function resolveAny(target: string, bases: readonly string[]): string | null {
  for (const base of bases) {
    const hit = resolveFromBase(base, target);
    if (hit) return hit;
  }
  return null;
}

// ---- plan-cell three-state + claim equivalence (P4.3 Task 8 #274 — the shared cell/claim faces) ----

/** The `[In-flight]` (started-but-not-complete) state — a started-but-not-complete plan column: the
 *  plan-doc existence glob applies (a non-missing cell) but the phase owes no closeout claim
 *  (reverse-claim carve-out). */
export function isInflightText(v: string): boolean {
  const t = (v ?? "").trim().toLowerCase();
  return t === "in-flight" || t === "[in-flight]";
}

/** Plan-cell state recognition — the three-state machine (P4.3 Task 8 #274): `[Pending]` (not
 *  started) → `[In-flight]` (started, not complete) → shipped (`**Done**` / a link-cell, + closeout
 *  claim). A pending cell carries no plan-doc obligation and no claim; an in-flight cell is a
 *  non-missing cell (the plan-doc glob still applies) but owes NO closeout claim and never counts
 *  as a mismatch; a shipped cell requires the plan doc AND a matching change-history claim. */
export function isPendingText(v: string): boolean {
  const t = (v ?? "").trim().toLowerCase();
  return t === "" || t === "pending" || t === "[pending]";
}

/** A SHIPPED plan column (claim-relevant): neither pending nor in-flight — `Done` / `**Done**` or a
 *  link-cell. The reverse-claim obligation and the forward claim equivalence apply to these only. */
export function isShippedColumn(v: string): boolean {
  return !isPendingText(v) && !isInflightText(v);
}

/** The schema cells.linkCell href atom (`[label](href)` — canonical links use ASCII parens). */
const CELL_LINK_RE = /\[[^\]]*\]\(([^)]*)\)/;

function linkHref(cell: string): string | null {
  const m = stripCellMarkup(cell).match(CELL_LINK_RE);
  return m?.[1] ? m[1] : null;
}

export function stripCellMarkup(v: string): string {
  return (v ?? "").replace(/\*\*/g, "").trim();
}

/** Own plan-document name identity — the phase's own plan doc is `*-<slug>-<id>.md` or the
 *  `-plan.md` variant, matched case-insensitively (the equivalence face canonicalizes its href, the
 *  existence glob canonicalizes the filename — one rule, both faces). */
export function isOwnPlanDocName(name: string, slug: string, id: string): boolean {
  const low = name.toLowerCase();
  const idLow = id.toLowerCase();
  return low.endsWith(`-${slug}-${idLow}.md`) || low.endsWith(`-${slug}-${idLow}-plan.md`);
}

/** The phase's OWN design-spec token `P<digits>(.digits)*-design` in its Design spec column
 *  (cross-references like `（源 P3-design）` are NOT the own token). Derived from the canonical
 *  designToken pattern — the digit ridge (`\d+(\.\d+)*`) is replaced by the validated inventory
 *  phase id's own digits (regex-escaped — dotted sub-phase ids embed literal dots), so the own
 *  token is exact (`P2.1-design` owns P2.1, never P2's token). */
export function ownDesignToken(col: string, phaseId: string): string | null {
  const suffix = escapeRegExp(phaseId.replace(/^P/i, ""));
  const own = new RegExp(DESIGN_TOKEN_RE.source.replace("\\d+(\\.\\d+)*", suffix), "i");
  const m = (col ?? "").match(own);
  return m ? m[0] : null;
}

/** Plan-cell ↔ claim equivalence, own-document aligned (the design column's ownDesignToken is the
 *  model — no per-character literal comparison): a plan cell satisfies a claim for phase `id` under
 *  the program slug when
 *   (a) the cell is PENDING → never (a claim declares the phase shipped);
 *   (b) the cell is IN-FLIGHT → true — the mid-dispatch carve-out (owes no reverse claim and is
 *       never counted against a claim);
 *   (c) the cell is a LINK-CELL → equal when its href resolves to the phase's OWN plan document
 *       (`*-<slug>-<id>.md` / `*-<slug>-<id>-plan.md` — the same glob the ② existence face uses);
 *   (d) a bare `Done`-style token → the strict claim-key equality (stripCellMarkup === claimKey). */
export function planCellMatchesClaim(cell: string, id: string, key: string, slug: string): boolean {
  if (isPendingText(cell)) return false;
  if (isInflightText(cell)) return true; // carve-out — in-flight is never a mismatch
  const href = linkHref(cell);
  if (href) {
    return isOwnPlanDocName(path.basename(href), slug, id);
  }
  return stripCellMarkup(cell) === key;
}

// ---- claim family (the claim-clause window scan — the schema-derived single source) ----

// Claim link words — the canonical single/range patterns are the anchored leaf; the audit's
// contains-search form strips the anchors (the search word boundaries) — the phrase family the
// retiring scripts guarded matched unanchored with the same body. The `P<digits>(.digits)*-design`
// design-spec token (sub-phase ids allowed: `P2.1-design`) is the canonical claimPatterns.designToken
// scan.
const PLAN_LINK_WORD = linkWordSearch(DOC_TOKENS.planLinkWordRe);
const DESIGN_LINK_WORD = linkWordSearch(DOC_TOKENS.designLinkWordRe);
const DESIGN_TOKEN_RE = DOC_TOKENS.designTokenScanRe;

function linkWordSearch(anchored: RegExp): RegExp {
  return new RegExp(anchored.source.replace(/^\^/, "").replace(/\$$/, ""), "i");
}

/** The explicit-claim scan needs the `g` flag (matchAll); the canonical CLAIM_RE stays the
 *  anchor-free pattern-keyword single source — this clone is parse mechanics only. */
const CLAIM_SCAN_RE = new RegExp(DOC_TOKENS.claimClauseRe.source, "g");

// Phase references inside a claim clause — single + ranged (endpoints included), the canonical
// claim-pattern scan forms. The full captured id (digit ridge included) is the verbatim
// reference — a `P2.1` claim targets P2.1, never its numeric base.
//
// C2 ⑦ (strict grammar-A, cdd-review-contract-fix): a letter-suffixed ref (`P3.10a`) is masked
// before the valid scans — the suffix is never silently swallowed into the numeric parent
// (`P3.10`); the illegal token rides its own channel (illegalPhaseRefsIn).
const ILLEGAL_PHASE_REF_RE = /\bP\d+(?:\.\d+)*[a-z]+\b/gi;

/** C2 ⑦ — mask the letter-suffixed refs 1:1 (offset-preserving) so the valid single/range scans never
 *  see the illegal shapes. */
function withoutIllegalRefs(clause: string): string {
  return clause.replace(ILLEGAL_PHASE_REF_RE, (t) => " ".repeat(t.length));
}

/** C2 ⑦ — the letter-suffixed phase-id forms in a claim declaration slot (`P3.10a`), the strict
 *  grammar-A violations the parse must surface as an error rather than swallow into the parent. */
function illegalPhaseRefsIn(clause: string): string[] {
  return [...new Set([...clause.matchAll(ILLEGAL_PHASE_REF_RE)].map((m) => m[0]))];
}

/** The pids a canonical RANGE ref contributes over a clause span — every endpoint + its
 *  shared-ridge intermediate (a cross-ridge range stays verbatim). The C2 ⑧ per-pid mechanism
 *  attribution reads this set: a single-phase ref inside a ranged declaration window is never
 *  labeled `range` — only the pids below report the range mechanism.
 *  The expansion is segment-aware over the shared digit ridge (`P1–P4` → P1..P4; `P2.1–P2.3` →
 *  P2.1..P2.3): the last segment iterates only when both endpoints share every earlier segment;
 *  endpoints that differ before the last segment stay verbatim (a cross-bootstrap range has no
 *  canonical intermediates). */
function rangeContributedIds(clause: string): Set<string> {
  const sanitized = withoutIllegalRefs(clause);
  const ids = new Set<string>();
  for (const m of sanitized.matchAll(DOC_TOKENS.claimPhaseRangeRe)) {
    const a = m[1];
    const b = m[3];
    const digitsA = m[2]; // the endpoint digit ridges (e.g. "2.1")
    const digitsB = m[4];
    const lastA = digitsA.lastIndexOf(".");
    const lastB = digitsB.lastIndexOf(".");
    const preA = lastA === -1 ? "" : digitsA.slice(0, lastA);
    const preB = lastB === -1 ? "" : digitsB.slice(0, lastB);
    if (preA === preB) {
      const lo = Math.min(Number(digitsA.slice(lastA + 1)), Number(digitsB.slice(lastB + 1)));
      const hi = Math.max(Number(digitsA.slice(lastA + 1)), Number(digitsB.slice(lastB + 1)));
      const base = a.slice(0, a.length - digitsA.length) + (preA ? `${preA}.` : "");
      for (let n = lo; n <= hi; n++) ids.add(`${base}${n}`);
    } else {
      ids.add(a).add(b);
    }
  }
  return ids;
}

function phaseIdsIn(clause: string): string[] {
  // the single-scan surrounds the range walk — the range's own endpoints also match the single
  // form, deduped against the expanded set.
  const ids = rangeContributedIds(clause);
  for (const m of withoutIllegalRefs(clause).matchAll(DOC_TOKENS.claimSinglePhaseRe)) ids.add(m[1]);
  return [...ids];
}

/** C2 ⑤ — parenthetical masking: a claim literal inside `（…）` (or `(…)`) is prose, never a
 *  declaration. The mask replaces parenthetical content with spaces 1:1 (offset-preserving) so the
 *  claim/range scans below simply skip it; markdown link bodies `[label](target)` are phase
 *  references, NOT parenthetical prose — they survive untouched. */
function maskParentheticals(clause: string): string {
  const masked = clause.split("");
  const protectedRange = new Array<boolean>(masked.length).fill(false);
  for (const m of clause.matchAll(LINK_RE)) {
    if (m.index === undefined) continue;
    for (let i = m.index; i < m.index + m[0].length; i++) protectedRange[i] = true;
  }
  let depth = 0;
  for (let i = 0; i < masked.length; i++) {
    if (protectedRange[i]) continue;
    const ch = masked[i];
    if (ch === "（" || ch === "(") {
      depth++;
      masked[i] = " ";
    } else if (ch === "）" || ch === ")") {
      if (depth > 0) depth--;
      masked[i] = " ";
    } else if (depth > 0) {
      masked[i] = " ";
    }
  }
  return masked.join("");
}

// C2 ⑤ declaration-slot discrimination (structural — the #274 residual-shape closeout): a
// `Pending`/`[Pending]` literal opens a claim declaration ONLY at a declaration-slot head —
// everything between the previous declaration (or clause start) and the literal is a
// phase-attribution prefix (phase refs / link-form phase references / the schema link words) +
// structural punctuation, never free prose. Guide words (link-form / example / method phrases) are
// deliberately NOT in the closed attribution set — the discrimination is a structural rule, not a
// dictionary membership judgment. CLAIM_SLOT_SUBSTANTIVE_RE covers the attribution atoms (longest
// alternatives first), CLAIM_SLOT_GAP_RE the punctuation a declaration slot may close with.
// The plan branch embeds the schema-derived PLAN_LINK_WORD source so a claimPatterns.planLinkWord
// evolution follows the discrimination set; the design words stay loose per-word atoms
// (`design|spec`) — the schema's `Design spec` phrase, a deliberate widening — and
// `implementation|设计|规格|回填|实现` are engine-local attribution vocabulary with no schema leaf.
const CLAIM_SLOT_SUBSTANTIVE_RE = new RegExp(
  `\\[[^\\]]*\\]\\([^)]*\\)|\\bP\\d+(?:\\.\\d+)*[a-z]*\\b|${PLAN_LINK_WORD.source}|implementation|design|spec|设计|规格|回填|实现`,
  "gi",
);
const CLAIM_SLOT_GAP_RE = /^[\s　：:，,、+・\-–—]*$/;

/** C2 ⑤ — true when the (paren-masked) slot span preceding a claim literal is a pure
 *  phase-attribution prefix: the LAST substantive (phase ref / link form / link word) is followed
 *  only by structural punctuation + whitespace. A prose run (connective or content words outside
 *  the closed attribution set) breaks the prefix → the literal is not declared. An entirely empty
 *  slot (a clause-head literal) is the vacuous head. */
function isDeclarationSlotHead(maskedSpan: string): boolean {
  const subs = [...maskedSpan.matchAll(CLAIM_SLOT_SUBSTANTIVE_RE)];
  if (subs.length === 0) return maskedSpan.trim() === "";
  const last = subs[subs.length - 1];
  return CLAIM_SLOT_GAP_RE.test(maskedSpan.slice((last.index ?? 0) + last[0].length));
}

/** One change-history row element — the claim extraction's consumed parse slice (the overall
 *  parse's historyRows element shape, structurally identical). */
export interface HistoryRow {
  version: [number, number] | null;
  date: string;
  summary: string;
}

interface ClaimWindow {
  text: string;
  phases: string[];
  /** C2 ⑧ — the phases a canonical RANGE ref contributed to this window (every endpoint +
   *  intermediate, the ⑥ expansion) — the per-pid parse-mechanism attribution face: a mixed
   *  declaration slot holds ranges AND single refs, and only the pids below report `range` (a
   *  single ref inside a ranged window stays `single`). */
  rangePhases: string[];
  /** C2 ⑦ — illegal phase-id tokens in this claim's declaration slot (the slot stops at the
   *  error state; the tokens are never attributed to a numeric parent). */
  illegal: string[];
  /** C2 ⑥⑧ — true when a canonical RANGE ref contributed to this claim's phases (a
   *  declaration-position range: every endpoint + intermediate is a separate target, and the
   *  diagnosis's expanded-list face rides the trace). */
  ranged: boolean;
}

/** The explicit-claim window scan (P4.3 Task 8 #274, C2 ⑤⑥⑦ — only DECLARED claim structures
 *  count): a `；`-clause may carry a claim AND prose that happens to mention phases
 *  (dependency-graph refs, cross-references). Phase attribution reads the WINDOW — the span from
 *  after the previous declaration's target (+ its closing parens) to the current declaration
 *  match — so a prose-mentioned phase after a claim never becomes a target (a whole-clause scan
 *  was the P3.8 false-claim source).
 *
 *  C2 ⑤ (discrimination): a claim literal must sit at a declaration-slot head AND outside `（…）`
 *  parentheticals; parenthetical / non-head literal hits are prose hints (parenthetical-inline +
 *  non-head), never declared, never part of the convergence audit (the #274 residual face). C2 ⑥
 *  (range): ranges expand inside a declaration window to EVERY phase — the multi-target
 *  declaration payload; a prose-position range yields nothing because no declaration is made. C2 ⑦
 *  (grammar): a letter-suffixed ref (`P3.10a`) in a declaration slot is an illegal phase-id — the
 *  parse phase slot stops at the error state (never the numeric-parent swallow) and the token
 *  rides the `illegal` channel for the diagnosis payload.
 *
 *  Phases outside every window are the `stray` set — the diagnosis-hint surface (same-clause prose
 *  mentioning a phase also made it a target under the retired whole-clause scan). */
function claimWindows(clause: string): {
  claims: ClaimWindow[];
  stray: string[];
  illegal: string[];
} {
  const masked = maskParentheticals(clause);
  const wholeClause = new Set(phaseIdsIn(clause));
  const windowed = new Set<string>();
  const claims: ClaimWindow[] = [];
  let from = 0;
  for (const m of masked.matchAll(CLAIM_SCAN_RE)) {
    const at = m.index ?? 0;
    const span = masked.slice(from, at);
    if (!isDeclarationSlotHead(span)) {
      // C2 ⑤ — a non-head literal is prose: skip past it so its window content cannot leak phases
      // into a later declaration's window.
      from = at + m[0].length;
      while (from < masked.length && /[\s）)]/.test(masked[from]!)) from++;
      continue;
    }
    const phases = phaseIdsIn(span);
    const rangePhases = rangeContributedIds(span);
    // C2 ⑥⑧ — a declaration-position range expands to every phase (endpoints included); the
    // C2 ⑧ fault context carries the expanded list. Range detection on the same sanitized surface
    // phaseIdsIn scans (a letter-suffixed range is already masked → never a range).
    const ranged = rangePhases.size > 0;
    for (const id of phases) windowed.add(id);
    claims.push({
      // the ORIGINAL text (the mask preserves offsets 1:1)
      text: clause.slice(at, at + m[0].length),
      phases,
      // the C2 ⑧ per-pid mechanism face — only the range-expanded pids report `range`
      rangePhases: [...rangePhases],
      illegal: illegalPhaseRefsIn(span),
      ranged,
    });
    // The next claim's window starts after this claim's target — skip the closing parens that wrap
    // it so a trailing `（…）` annotation does not leak phase refs into the next window.
    from = at + m[0].length;
    while (from < masked.length && /[\s）)]/.test(masked[from]!)) from++;
  }
  const stray = [...wholeClause].filter((id) => !windowed.has(id));
  return {
    claims,
    stray,
    illegal: [...new Set(claims.flatMap((c) => c.illegal))],
  };
}

/** C2 ⑧ — the parse-mechanism face of a claimed phase: how the parse attributed the id. */
type ClaimParseMechanism = "single" | "range";

/** The change-history table row identity — the trio's location face (the table row the failing
 *  clause came from): `v1.1 · 2026-09-21` from the parsed row. */
function historyRowLabel(row: { version: [number, number] | null; date: string }): string {
  const v = row.version ? `v${row.version[0]}.${row.version[1]}` : "no-version";
  return `${v} · ${row.date}`;
}

/** The parse mechanism in operator-facing words (the fault-context mechanism element). */
function mechanismText(mechanism: ClaimParseMechanism, expandedCount: number): string {
  return mechanism === "range"
    ? `a declaration-position range (${expandedCount} phases)`
    : "a single-phase declaration";
}

/** C2 ⑧ — the trio's fault context (1) + category-dispatched suggestion (2) appended to a
 *  forward-mismatch failure's `missing`. The executable action (3) rides the failure's `fix`.
 *  Fault context: the claiming clause excerpt · the parsed phase · the parse mechanism · (⑥) the
 *  expanded phase list for range declarations. Category dispatch: prose class — the same-clause
 *  prose collision is named with the isolate wording when the clause prose-mentions other phases. */
export function mismatchDiagnosticHint(trace: ClaimDeclarationTrace, strays: string[]): string {
  const parts = [
    `claim ${JSON.stringify(trace.clause)} (row ${trace.row}) → parses phase ${trace.pid} via ${mechanismText(trace.mechanism, trace.expanded.length)}`,
  ];
  if (trace.mechanism === "range") {
    parts.push(`the declaration expands to phases: ${trace.expanded.join(", ")}`);
  }
  if (strays.length > 0) {
    parts.push(
      `category: prose — same-clause prose also mentions ${strays.join(", ")}; isolate the prose with the \`；\` clause separator if they are not claim phases`,
    );
  }
  return ` — ${parts.join("; ")}`;
}

/** C2 ⑧ — the dotted legal-shape guidance for a letter-suffixed phase id (`P3.10a`): the fixed
 *  rename target the syntax-class suggestion + action name. Only a single-letter suffix within the
 *  documented rename debt maps positionally (a→1 … e→5 — the P3.10a–e → P3.10.1–.5 backfill naming
 *  collection); a letter beyond `e` or any multi-letter suffix has no rename target the debt
 *  defines, so the guidance keeps the generic dotted-form shape (`P<digits>.<digits>`) — never a
 *  fabricated phase position. */
export function dottedLegalHint(token: string): string {
  const m = token.match(/^(P\d+(?:\.\d+)*)([a-zA-Z]+)$/);
  if (m) {
    const letters = m[2]!.toLowerCase();
    const pos = letters.length === 1 ? letters.charCodeAt(0) - "a".charCodeAt(0) + 1 : 0;
    // the positional rename covers exactly the documented a→1 … e→5 range; beyond `e` the suffix
    // keeps the generic shape (zero-misleading — a fabricated position would misdirect the fix).
    if (pos >= 1 && pos <= 5) return `${m[1]}.${pos}`;
  }
  return "`P<digits>.<digits>`";
}

/** A claim target normalized to a comparable key: `P<digits>(.digits)*-design` token for design
 *  claims, else the bare `Done`-style token (trailing closing brackets stripped). An attached
 *  ASCII sentence period is stripped too — it binds to the target now that the canonical CLAIM_RE
 *  stop-set exempts `.` (dotted sub-phase ids like `P2.1-design` embed literal periods). */
function claimKey(raw: string): string {
  const t = stripCellMarkup(raw)
    .replace(/[）】\]]+$/u, "")
    .replace(/\.+$/u, "");
  const d = t.match(DESIGN_TOKEN_RE);
  return d ? d[0] : t;
}

/** The canonical claim pattern is a pattern-keyword (its capture groups are non-capturing — the
 *  arrow + the target class). The target is the match tail after the arrow — parse mechanics on the
 *  canonical match text, the pattern itself stays canonical. */
function claimTarget(full: string): string {
  const match = full.match(/^(?:Pending|\[Pending\])\s*(?:→|->)\s*(.*)$/);
  return match ? match[1] : "";
}

/** C2 ⑧ — the declaration trace backing the diagnostic trio: one record per REMEMBERED claim (the
 *  same iteration that fills planClaims/designClaims), carrying the fault context a doc-contract
 *  failure anchors to — the claiming clause excerpt · the parsed phase · the parse mechanism · (⑥)
 *  the expanded phase list for declaration-position ranges. The category dispatch + executable
 *  action assemble from it at the failure surface. */
export interface ClaimDeclarationTrace {
  /** the claim's lane — plan (Implementation plan column) or design (Design spec column). */
  lane: "plan" | "design";
  /** the phase the claim parsed to. */
  pid: string;
  /** the claim target key (`Done` / a `P<n>-design` token). */
  key: string;
  /** the claiming clause (verbatim — the fault-context clause excerpt). */
  clause: string;
  /** how the parse attributed THIS pid: `single` (a single-phase ref) or `range` (contributed by
   *  a declaration-position range's expansion, C2 ⑥⑧ — each endpoint + intermediate is a separate
   *  target). Attribution is PER-PID — a single ref inside a ranged window stays `single`. */
  mechanism: ClaimParseMechanism;
  /** C2 ⑥ — the expanded phase list for a range declaration (endpoints included — the SAME payload
   *  phaseIdsIn produced at parse time, so the diagnosis can never drift from the parse); empty for
   *  single-phase declarations. */
  expanded: string[];
  /** the change-history table row identity (`v1.1 · 2026-09-21`) — the location face. */
  row: string;
}

export interface ClaimExtraction {
  planClaims: Map<string, string>;
  designClaims: Map<string, string>;
  /** Same-clause prose collision (Task 8 diagnosis): claim phase → the stray clause phases ITS
   *  clause mentions outside the explicit claim structure — the ids a whole-clause scan would have
   *  made claim targets too. Forward-mismatch failures fold these into the C2 ⑧ prose-class category
   *  dispatch (the isolate-with-`；` wording). */
  proseHints: Map<string, string[]>;
  /** C2 ⑦ illegal phase-id carrier — strict grammar-A violations found in claim declaration slots
   *  (letter-suffixed refs like `P3.10a`, one record per occurrence: the offending token + the
   *  clause that carries it + the change-history row — the offending context the diagnostic trio
   *  anchors to). The parse phase slot stops at the error state — the token is never swallowed into
   *  the numeric parent nor attributed as a claim target. Structured fact surface only; the guidance
   *  wording is the payload surface (the T5 diagnostic trio). */
  illegalPhaseRefs: Array<{ clause: string; token: string; row: string }>;
  /** C2 ⑧ — the declaration traces backing the diagnostic trio (one per remembered claim; the same
   *  iteration that fills planClaims/designClaims). The forward-mismatch failures assemble their
   *  fault context (clause · parsed phase · mechanism · ⑥ expanded list) from these. */
  traces: ClaimDeclarationTrace[];
}

/** ① Claim extraction: walk the change-history summaries clause by clause; a clause whose link
 *  word matches `plan`/`计划` carries a plan claim (`Pending → Done`-style target), one matching
 *  `Design spec` carries a design claim with a `P<n>-design` target token. Phase attribution reads
 *  the explicit claim windows — a same-clause prose-mentioned phase is never a target (Task 8).
 *  The declaration set the closeout terminal state merges into (P2 ④). */
export function extractClaimRows(historyRows: readonly HistoryRow[]): ClaimExtraction {
  const planClaims = new Map<string, string>();
  const designClaims = new Map<string, string>();
  const proseHints = new Map<string, string[]>();
  const illegalPhaseRefs: ClaimExtraction["illegalPhaseRefs"] = [];
  const traces: ClaimDeclarationTrace[] = [];
  for (const row of historyRows) {
    const rowLabel = historyRowLabel(row);
    for (const clause of (row.summary ?? "").split(DOC_TOKENS.claimClauseSeparatorRe)) {
      const { claims, stray, illegal } = claimWindows(clause);
      // C2 ⑦ — every illegal phase-id found in a declared slot is a grammar-A violation the
      // audit surfaces (parse slot already stopped: no numeric-parent attribution happened).
      for (const token of illegal) illegalPhaseRefs.push({ clause, token, row: rowLabel });
      const planLink = PLAN_LINK_WORD.test(clause);
      const designLink = DESIGN_LINK_WORD.test(clause);
      for (const c of claims) {
        const key = claimKey(claimTarget(c.text));
        const planTarget = !!key && !isPendingText(key) && !DESIGN_TOKEN_RE.test(key);
        const designTarget = !!key && DESIGN_TOKEN_RE.test(key);
        if ((planTarget && planLink) || (designTarget && designLink)) {
          const map = planTarget ? planClaims : designClaims;
          const lane: ClaimDeclarationTrace["lane"] = planTarget ? "plan" : "design";
          for (const pid of c.phases) {
            // C2 ⑧ — one trace per REMEMBERED claim (the same first-wins guard as the claim map),
            // carrying the fault-context the diagnostic trio assembles from. The parse mechanism
            // is PER-PID: only a pid the range expansion contributed reports `range` — a
            // single-phase ref inside a ranged window stays `single` (a mixed declaration slot
            // never misreports the range mechanism).
            if (!map.has(pid)) {
              map.set(pid, key);
              const fromRange = c.rangePhases.includes(pid);
              traces.push({
                lane,
                pid,
                key,
                clause,
                mechanism: fromRange ? "range" : "single",
                expanded: c.ranged ? [...c.phases] : [],
                row: rowLabel,
              });
            }
            if (stray.length > 0) {
              const existing = proseHints.get(pid) ?? [];
              proseHints.set(pid, [...new Set([...existing, ...stray])]);
            }
          }
        }
      }
    }
  }
  return { planClaims, designClaims, proseHints, illegalPhaseRefs, traces };
}
