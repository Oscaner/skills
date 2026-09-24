// packages/cdd-engine/src/documents/tokens.ts — canonical doc-structure token surface
// (P2 T2 ①②; design §2.3 AC4 TC 单源实证). Every engine-side doc-structure TOKEN (the literals
// and patterns documents.ts / brief.ts / task.ts assert) derives here from the canonical
// doc-structure JSON Schemas (documents/schema/*.json, loaded via loadDocSchema). The former
// hand-written copies in each consumer are these derivations. Change a canonical definition once →
// engine validation/extraction follows in the same build — the deriveDocTokens(schemas) pure
// function is that live link (feed it a doctored schema and the derived token changes).
//
// Derivation shapes:
//   - const  → the literal token directly
//   - pattern → compiled as a regex; capture groups are parse mechanics inserted at the version
//               token (the engine needs `(v\d+\.\d+)` where the schema stores the pattern shape);
//   - "N" in task-heading format → the canonical number placeholder (schema description).
//   - phase-spec marker → the shared version marker's page twin: derived from phase-spec.json and
//     asserted equal to the overall marker at load, so the two pages cannot silently drift.
// Generic markdown/link/placeholder atoms (LINK_RE, PLACEHOLDER_RE) stay engine-local — they are
// parsing primitives, not doc-structure definitions.
import { loadDocSchema } from "./schema.ts";

export interface DocTokens {
  // ---- plan ----
  /** `**Spec:**` marker (plan.json header.specRef.marker.const). */
  specMark: string;
  /** `**Parent program**` marker (plan.json header.parentProgram.marker.const). */
  parentMark: string;
  /** The `**Version**` marker (overall.json header.version.marker.const). */
  versionMark: string;
  /** The phase-spec schema's `**Version**` marker const leaf — the shared marker's page twin,
   *  derived and held equal to the overall marker at load (a rename in either schema fails loudly). */
  phaseSpecVersionMark: string;
  /** Backticked field labels for guidance lines (derived from the markers). */
  specField: string;
  parentField: string;
  versionField: string;
  /** `### Task N:` — the canonical task-heading format; "N" is the number placeholder. */
  taskHeadingFormat: string;
  /** The concrete heading for a task number (`### Task N:` → `### Task 7:`). */
  taskHeadingFor: (n: number) => string;
  /** `### Task ` — the task-heading prefix (format up to the placeholder). */
  taskHeadingPrefix: string;
  /** The `:` suffix after the task number in the heading format. */
  taskHeadingSuffix: string;
  /** `/^### Task (\d+):/` — tolerant number-capture scan (titles after the colon allowed). */
  taskNumberRe: RegExp;
  /** `/^### Task \d+:/` — tolerant heading boundary (brief slicing / constraints block stop). */
  taskHeadingRe: RegExp;
  /** `/^### Task /` — the heading-prefix boundary (constraints prose block stop). */
  taskHeadingPrefixRe: RegExp;
  /** `## Constraints` — the Form-A literal heading (derived from its canonical pattern). */
  constraintsHeading: string;
  /** `/^## Constraints\s*$/` — Form-A heading match. */
  constraintsHeadingRe: RegExp;
  /** `## Task Groups` — the taskGroups section heading (plan.json taskGroups section layout const). */
  taskGroupsHeading: string;
  /** `/^## Task Groups\s*$/` — the taskGroups section-heading match. */
  taskGroupsHeadingRe: RegExp;
  /** `^- \*\*Task (?:…numbers…)\*\*:` — one merged-group line with the comma-space number list
   *  captured as group 1 (plan.json taskGroups section entry pattern, capture-inserted). */
  taskGroupsLineRe: RegExp;
  /** 2 — the canonical per-group minimum task count (plan.json taskGroups items tasks minItems) —
   *  the length-1-redundant floor (single-group state exists only as the empty default). */
  taskGroupsMinItems: number;
  /** The four Form-B prose-anchor tokens verbatim (plan schema enum). */
  proseAnchorTokens: string[];
  /** The four bare anchor names (tokens stripped of `**` wraps + colon) for regex building. */
  proseAnchors: string[];
  // ---- overall ----
  /** `/^\s*-?\s*\*\*Version\*\*:\s*(v\d+\.\d+)/m` — version line + captured token. */
  versionHeaderRe: RegExp;
  /** `/^\s*\|\s*(v\d+\.\d+)\s*\|/` — change-history version cell + captured token. */
  historyVersionCellRe: RegExp;
  /** `/v\d+\.\d+/g` — unanchored version-token scan (parent-line lineage). */
  versionTokenRe: RegExp;
  /** `/^\|\s*#\s*\|\s*Phase\s*\|/` — Phase-inventory header open. */
  phaseHeaderRe: RegExp;
  /** `| # | Phase | Scope | … |` — the canonical 7-column Phase-inventory header row. */
  phaseInventoryHeader: string;
  /** `Implementation plan` — the canonical-form marker column name. */
  canonicalColumn: string;
  /** `/\bImplementation plan\b/` — canonical-column match (word-boundary guard). */
  canonicalColumnRe: RegExp;
  /** `## Change history` section heading. */
  changeHistoryHeadingRe: RegExp;
  /** `/^\|\s*P/` — Phase-inventory row open (row-shape guard's row detector). */
  phaseRowOpenRe: RegExp;
  /** 8 — the canonical Phase-inventory row cell count (row-shape guard). */
  phaseRowCellCount: number;
  /** `/^v(\d+)\.(\d+)$/` — change-history version cell parsed for the ascending/duplicate check. */
  versionNumericRe: RegExp;
  /** `/\bP(\d+(?:\.\d+)*)/i` — plan-filename phase-id scan (filename form of the canonical id). */
  phaseIdScanRe: RegExp;
  // ---- claim family (overall.json claimPatterns; consumed by the docs audit from T3) ----
  /** The CLAIM_RE clause pattern — compiled live from the canonical single source. */
  claimClauseRe: RegExp;
  /** `plan` link word pattern (claim → plan backfill). */
  planLinkWordRe: RegExp;
  /** `Design spec` link word pattern (claim → design backfill). */
  designLinkWordRe: RegExp;
  /** Claim-clause boundary — `；`/`;` split a change-history sentence into clauses (the ASCII
   *  sibling is documented next to the canonical const). */
  claimClauseSeparatorRe: RegExp;
  /** Single-phase claim reference scan (claimPatterns.phaseReference.single) — the FULL canonical
   *  phase id captured as one group (digit ridge `\d+(\.\d+)*`, e.g. `P2.1`) with its ridge
   *  captured inside (group 2) — a `P2.1` reference stays verbatim, never collapses to `P2`. */
  claimSinglePhaseRe: RegExp;
  /** Ranged claim reference scan (claimPatterns.phaseReference.range, endpoints included) — both
   *  endpoint FULL ids captured (groups 1 & 3, digit ridge included) with their ridges inside
   *  (groups 2 & 4). */
  claimPhaseRangeRe: RegExp;
  /** Design-spec token scan (`P<digits>(.digits)*-design`, sub-phase ids allowed: `P2.1-design`) —
   *  the unanchored scan form of claimPatterns.designToken; the design-doc / design-claim target
   *  token. */
  designTokenScanRe: RegExp;
  /** The design-document filename tail (`-design.md`) — the canonical designToken body's `-design`
   *  literal lowercased + `.md` (the filePaths filename form `*-<slug>-<phase-id>-design.md`). */
  designDocTail: string;
  /** `## Issue inventory` section heading (sectionHeadings.issueInventory const). */
  issueInventoryHeading: string;
  /** `## Dependency graph` heading — literal or `(ASCII)` suffix (sectionHeadings.dependencyGraph). */
  dependencyGraphHeadingRe: RegExp;
  /** Issue-anchor scan (`#NNN#issuecomment-<digits>` — issueInventory.row.anchorForm) with the
   *  issue number captured — the anchor-registry registration-domain atom. */
  issueAnchorFormRe: RegExp;
  /** Phase-id token scan (rowShape.idFormat pattern, unanchored + word boundary) — the dependency
   *  graph / dependency-column membership audit's token scanner. */
  phaseTokenScanRe: RegExp;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Navigate a loaded schema JSON to a node by its `properties` path. A segment is first tried as a
 * `properties` child (the schema-tree idiom), falling back to a DIRECT key on the current node
 * (for non-property keywords like `items` / `enum` / `const` used as navigation steps). */
function nodeAt(schema: unknown, props: readonly string[]): Record<string, unknown> {
  let cur = schema as Record<string, unknown>;
  for (const key of props) {
    const viaProps = (cur?.["properties"] as Record<string, unknown> | undefined)?.[key];
    cur = (viaProps ?? (cur as Record<string, unknown>)[key]) as Record<string, unknown>;
    if (cur === null || cur === undefined) {
      throw new Error(`doc-structure token path not found: ${props.join(".")}`);
    }
  }
  return cur;
}

/** Whole-path leaf: navigate `properties` path then read the given keyword (const/pattern/enum). */
function leaf<T = unknown>(schema: unknown, props: readonly string[], keyword: string): T {
  const node = nodeAt(schema, props);
  if (!(keyword in node)) {
    throw new Error(`doc-structure token "${keyword}" not found at ${props.join(".")}`);
  }
  return node[keyword] as T;
}

/** The version-token body (`v\d+\.\d+`) derived from the canonical change-history version-token
 * pattern (`^v\d+\.\d+$`, anchors stripped) — the shared embedded token of the version family. */
function versionTokenBody(overall: unknown): string {
  const anchored = leaf<string>(overall, ["changeHistory", "row", "versionToken"], "pattern");
  return anchored.replace(/^\^/, "").replace(/\$$/, "");
}

/** Insert a capture group around the version token inside a canonical pattern, keeping everything
 * else byte-faithful — the pattern is the canonical fact, the capture is parse mechanics. */
function capturing(pattern: string, token: string, flags = ""): RegExp {
  return new RegExp(pattern.replace(token, `(${token})`), flags);
}

/** Capture every `\d+` run inside a canonical pattern (replacing each with `(\d+)` — the same
 * capture-insertion trick as versionNumericRe) — parse mechanics, the pattern stays canonical. */
function digitCapturing(pattern: string, flags = ""): RegExp {
  return new RegExp(pattern.replace(/\\d\+/g, "(\\d+)"), flags);
}

/** Wrap every occurrence of a canonical phase-id token inside a claim phase-reference pattern in
 * capture groups — each full id (digit + dot-digit segments) captured, with its digit ridge
 * (`\d+(\.\d+)*`) captured inside the full group — so a `P2.1` reference survives verbatim. Parse
 * mechanics, the canonical pattern otherwise stays byte-faithful; a pattern that lacks the token
 * (schema drift) fails loudly rather than deriving a capture-less scan. */
function phaseRefCapturing(pattern: string, token: string, flags = ""): RegExp {
  const body = pattern.replace(/^\^/, "").replace(/\$$/, "");
  if (!body.includes(token)) {
    throw new Error(
      `doc-structure token: claim phase-reference pattern "${body}" lacks the canonical phase-id token "${token}"`,
    );
  }
  const tile = `(${token.replace("\\d+(\\.\\d+)*", "(\\d+(?:\\.\\d+)*)")})`;
  return new RegExp(body.split(token).join(tile), flags);
}

export function deriveDocTokens(schemas: {
  plan: unknown;
  overall: unknown;
  "phase-spec": unknown;
}): DocTokens {
  const { plan, overall, "phase-spec": phaseSpec } = schemas;

  const specMark = leaf<string>(plan, ["header", "specRef", "marker"], "const");
  const parentMark = leaf<string>(plan, ["header", "parentProgram", "marker"], "const");
  const versionMark = leaf<string>(overall, ["header", "version", "marker"], "const");
  // The phase-spec schema pages the shared version marker as its own const leaf — derive it and
  // hold the two pages equal at load, so a rename in either schema fails loudly instead of silently
  // drifting inside the single-source plane.
  const phaseSpecVersionMark = leaf<string>(phaseSpec, ["header", "version", "marker"], "const");
  if (phaseSpecVersionMark !== versionMark) {
    throw new Error(
      `doc-structure token mismatch: phase-spec version marker "${phaseSpecVersionMark}" !== overall version marker "${versionMark}"`,
    );
  }

  const taskHeadingFormat = leaf<string>(plan, ["taskHeadings", "format"], "const");
  const placeholderIdx = taskHeadingFormat.indexOf("N");
  if (placeholderIdx === -1) {
    throw new Error("doc-structure token: task-heading format missing the 'N' number placeholder");
  }
  const taskHeadingPrefix = taskHeadingFormat.slice(0, placeholderIdx);
  const taskHeadingSuffix = taskHeadingFormat.slice(placeholderIdx + 1);
  const taskNumberRe = new RegExp(
    `^${escapeRegExp(taskHeadingPrefix)}(\\d+)${escapeRegExp(taskHeadingSuffix)}`,
  );
  const taskHeadingRe = new RegExp(
    `^${escapeRegExp(taskHeadingPrefix)}\\d+${escapeRegExp(taskHeadingSuffix)}`,
  );
  const taskHeadingPrefixRe = new RegExp(`^${escapeRegExp(taskHeadingPrefix)}`);

  const constraintsHeadingPattern = leaf<string>(
    plan,
    ["constraints", "formACanonical", "heading"],
    "pattern",
  );
  const constraintsHeading = constraintsHeadingPattern
    .replace(/^\^/, "")
    .replace(/\\s\*\$$/, "");
  const constraintsHeadingRe = new RegExp(constraintsHeadingPattern);

  // taskGroups (P4.3 Task 3, spec §2.2) — the dispatch-group declaration: the section heading
  // const, the merged-group entry pattern with the comma-space number list wrapped in ONE capture
  // group (the repeated `(?:, \d+)*` items stay non-capturing — group 1 is the full list), and the
  // per-group minimum (the write-back floor: a length-1 group is redundant, never declared).
  const taskGroupsHeading = leaf<string>(
    plan,
    ["taskGroups", "$defs", "section", "properties", "heading"],
    "const",
  );
  const taskGroupsEntryPattern = leaf<string>(
    plan,
    ["taskGroups", "$defs", "section", "properties", "entry"],
    "pattern",
  );
  const taskGroupsHeadingRe = new RegExp(`^${escapeRegExp(taskGroupsHeading)}\\s*$`);
  const taskGroupsLineRe = new RegExp(
    taskGroupsEntryPattern.replace("\\d+(?:, \\d+)*", "(\\d+(?:, \\d+)*)"),
  );
  const taskGroupsMinItems = leaf<number>(
    plan,
    ["taskGroups", "items", "properties", "tasks"],
    "minItems",
  );

  const proseAnchorTokens = leaf<string[]>(
    plan,
    ["constraints", "formBProseAnchors", "anchors", "items"],
    "enum",
  );
  const proseAnchors = proseAnchorTokens.map((t) =>
    t.replace(/^\*\*/, "").replace(/\*\*[：:].*$/, ""),
  );

  const versionToken = versionTokenBody(overall);
  const versionLinePattern = leaf<string>(overall, ["header", "version", "line"], "pattern");
  const versionHeaderRe = capturing(versionLinePattern, versionToken, "m");
  const versionCellPattern = leaf<string>(overall, ["changeHistory", "row", "versionCell"], "pattern");
  const historyVersionCellRe = capturing(versionCellPattern, versionToken);
  const versionTokenRe = new RegExp(versionToken, "g");

  const phaseHeaderRe = new RegExp(
    leaf<string>(overall, ["phaseInventory", "columnNames", "headerOpen"], "pattern"),
  );
  const phaseInventoryHeader = leaf<string>(
    overall,
    ["phaseInventory", "columnNames", "header"],
    "const",
  );
  const canonicalColumn = leaf<string>(
    overall,
    ["phaseInventory", "columnNames", "canonicalColumnToken"],
    "const",
  );
  const canonicalColumnRe = new RegExp(`${escapeRegExp(canonicalColumn)}\\b`);
  const changeHistoryHeading = leaf<string>(overall, ["sectionHeadings", "changeHistory"], "const");
  const changeHistoryHeadingRe = new RegExp(`^${escapeRegExp(changeHistoryHeading)}`);
  const phaseRowOpenRe = new RegExp(leaf<string>(overall, ["phaseInventory", "rowShape", "rowOpen"], "pattern"));
  const phaseRowCellCount = leaf<number>(overall, ["phaseInventory", "rowShape", "cellCount"], "const");
  // change-history version cell numeric parse — the anchored version-token pattern with each
  // digit-run captured (descending/duplicate detection needs the major.minor tuple)
  const versionNumericRe = new RegExp(
    leaf<string>(overall, ["changeHistory", "row", "versionToken"], "pattern").replace(
      /\\d\+/g,
      "(\\d+)",
    ),
  );

  // Plan-filename phase-id scan — the filename form of the canonical phase-id pattern
  // (`^P\d+(\.\d+)*$`): word-boundary-anchored, the full digit ridge captured — a `p2.1` filename
  // yields "P2.1", never the base "P2" the head digit run alone would produce.
  const phaseIdPattern = leaf<string>(overall, ["issueInventory", "row", "phaseId"], "pattern");
  const phaseIdScanRe = new RegExp(
    `\\b${phaseIdPattern.replace(/^\^/, "").replace(/\$$/, "").replace("\\d+(\\.\\d+)*", "(\\d+(?:\\.\\d+)*)")}`,
    "i",
  );

  const claimClauseRe = new RegExp(
    leaf<string>(overall, ["claimPatterns", "claimClause", "pattern"], "pattern"),
  );
  const planLinkWordRe = new RegExp(leaf<string>(overall, ["claimPatterns", "planLinkWord"], "pattern"));
  const designLinkWordRe = new RegExp(leaf<string>(overall, ["claimPatterns", "designLinkWord"], "pattern"));
  // Claim-clause boundary — the canonical `；` const + its documented ASCII sibling `;`.
  const claimClauseSeparatorRe = new RegExp(
    `[${escapeRegExp(leaf<string>(overall, ["changeHistory", "backfillClause", "clauseSeparator"], "const"))};]`,
    "g",
  );
  // Claim phase references — unanchored scan forms of the canonical single/range patterns; each
  // canonical phase-id token wrapped as a FULL capture group (digit ridge included, the ridge run
  // captured inside) — claim phase refs resolve verbatim (`P2.1` never collapses to `P2`).
  // The token is the claim single phase-reference body (the same token the range pairs).
  const claimPhaseRefToken = leaf<string>(
    overall,
    ["claimPatterns", "phaseReference", "single"],
    "pattern",
  )
    .replace(/^\^/, "").replace(/\$$/, "");
  const claimSinglePhaseRe = phaseRefCapturing(
    leaf<string>(overall, ["claimPatterns", "phaseReference", "single"], "pattern"),
    claimPhaseRefToken,
    "gi",
  );
  const claimPhaseRangeRe = phaseRefCapturing(
    leaf<string>(overall, ["claimPatterns", "phaseReference", "range"], "pattern"),
    claimPhaseRefToken,
    "g",
  );
  // Design-spec token scan + design-doc filename tail — both derived from the canonical
  // `P<digits>(.digits)*-design` pattern leaf (claimPatterns.designToken): the unanchored token
  // scan (sub-phase ids allowed: `P2.1-design` belongs to P2.1, never P2) and the design-document
  // `-design.md` tail (the filePaths filename form, lowercase).
  const designTokenBody = leaf<string>(
    overall,
    ["claimPatterns", "designToken"],
    "pattern",
  )
    .replace(/^\^/, "").replace(/\$$/, "");
  const designTokenScanRe = new RegExp(designTokenBody, "i");
  if (!designTokenBody.endsWith("-design")) {
    throw new Error(`doc-structure token: designToken pattern "${designTokenBody}" lacks the "-design" tail`);
  }
  const designDocTail = `${designTokenBody.slice(designTokenBody.indexOf("-design"))}.md`;
  // The four-table audit's section headings (validator-keyed — same derivation family as the
  // change-history heading token).
  const issueInventoryHeading = leaf<string>(overall, ["sectionHeadings", "issueInventory"], "const");
  const auditHeadingRe = (pattern: string): RegExp => {
    // Section-range scanning tests whole lines (`lines.findIndex(l => re.test(l))`) — the
    // canonical anchors (`^…$`) match the line extent exactly, so the pattern stays verbatim.
    return new RegExp(pattern);
  };
  const dependencyGraphHeadingRe = auditHeadingRe(
    leaf<string>(overall, ["sectionHeadings", "dependencyGraph"], "pattern"),
  );
  // Issue-anchor scan — the canonical anchored form (`^#\d+#issuecomment-\d+$`) unanchored, the
  // issue-number run captured (the anchor-registry membership atom).
  const issueAnchorFormRe = digitCapturing(
    leaf<string>(overall, ["issueInventory", "row", "anchorForm"], "pattern").replace(/^\^/, "").replace(/\$$/, ""),
    "g",
  );
  // Phase-id token scan — the canonical phase id (`^P\d+(\.\d+)*$`) unanchored with a leading
  // word boundary; the dependency-graph / dependency-column membership scanner.
  const phaseTokenScanRe = new RegExp(
    `\\b${leaf<string>(overall, ["phaseInventory", "rowShape", "idFormat"], "pattern").replace(/^\^/, "").replace(/\$$/, "")}`,
    "g",
  );

  return {
    specMark,
    parentMark,
    versionMark,
    phaseSpecVersionMark,
    specField: `\`${specMark}\``,
    parentField: `\`${parentMark}\``,
    versionField: `\`${versionMark}\``,
    taskHeadingFormat,
    taskHeadingFor: (n) => taskHeadingFormat.replace("N", String(n)),
    taskHeadingPrefix,
    taskHeadingSuffix,
    taskNumberRe,
    taskHeadingRe,
    taskHeadingPrefixRe,
    constraintsHeading,
    constraintsHeadingRe,
    taskGroupsHeading,
    taskGroupsHeadingRe,
    taskGroupsLineRe,
    taskGroupsMinItems,
    proseAnchorTokens,
    proseAnchors,
    versionHeaderRe,
    historyVersionCellRe,
    versionTokenRe,
    phaseHeaderRe,
    phaseInventoryHeader,
    canonicalColumn,
    canonicalColumnRe,
    changeHistoryHeadingRe,
    phaseRowOpenRe,
    phaseRowCellCount,
    versionNumericRe,
    phaseIdScanRe,
    claimClauseRe,
    planLinkWordRe,
    designLinkWordRe,
    claimClauseSeparatorRe,
    claimSinglePhaseRe,
    claimPhaseRangeRe,
    designTokenScanRe,
    designDocTail,
    issueInventoryHeading,
    dependencyGraphHeadingRe,
    issueAnchorFormRe,
    phaseTokenScanRe,
  };
}

/** Production token surface — derived from the canonical doc-structure schemas on load. */
export const DOC_TOKENS: DocTokens = deriveDocTokens({
  plan: loadDocSchema("plan"),
  overall: loadDocSchema("overall"),
  "phase-spec": loadDocSchema("phase-spec"),
});
