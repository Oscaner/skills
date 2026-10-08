// packages/cdd-engine/src-next/render/templates.ts
// T21 — the template-contract typed surface: the template-contract JSON's data-plane
// home PLUS the TemplateAssembler (one module, one renderer). The dispatch prompt
// data (the per-mode shell frames · the return-format block · the per-mode round
// context · the token registry · the clause partials) and the review criteria (the
// task/branch axes guide — P4) are typed constant data here, imported never parsed:
//
//   · TEMPLATE_PROMPT — the rendering data plane the assembler consumes; this
//     module renders over it (the JSON's $schema/_doc prose plane is gone).
//   · REVIEWS — the review criteria: the task/branch axes guides (the four axes +
//     the verification-evidence duty). P5 lands here: the "no parallel sub-agents"
//     phrase is deleted from the guide. P4 lands here: the criteria are typed data
//     the assembly face (face/cli.ts #reviewAxes) references — the spec/plan URC
//     rows ride the dispatch table (face/host.ts) with the writing-plans self-check
//     + the verification-evidence duty, and this guide carries the task/branch face.
//
// T15 v1.8 (the mode 分派表 — §3.5) restructures the prompt from "one all-mode
// manual + dynamic zone" to the per-mode dispatch table:
//   · MODE_PROMPTS — one row per work-mode (implement / fix / review / docs-fix):
//     the mode's FIXED prefix (its own instruction shell + the injected writable-
//     subset schema at the shell's tail — byte-identical for every dispatch of the
//     mode, so the prompt-cache prefix groups by mode) + the mode's REDUCED round-
//     context subset (only the keys the mode consumes; a key whose value is empty is
//     not emitted — 空值键不发).
//   · the normalized token vocabulary (§3.5 规整命名): INPUT_* (read-side) /
//     OUTPUT_* (write-side) / WORKSPACE_* (environment) / FIX_BASE (the fix anchor) /
//     ROLE + SCOPE (the nominative identity). The old MODE/DISPATCH_UNIT/BRIEF/…
//     names are gone (零旧名残留 grep).
//
// T15 v1.9 (the handoff 契约面 rework — §3.6) lands the schema injection in the
// same plane: the `## Handoff schema` section at every mode shell's tail carries the
// {{HANDOFF_SCHEMA}} slot (projection ① of session/handoff-schema.ts — the same
// declared objects the engine validates the draft against, projection ②). The
// `## Handoff` prose section and the HANDOFF_WRITE_GATE gate are DELETED; the
// RETURN_JSON / DOCS_FIX return faces are retired — RETURN_STDOUT_BLOCK is the ONE
// return contract (child 产出一律落盘: the block's three lines are the pointer; the
// content lives in the draft file the engine reads back).
//
// P5 (M1) supersede: the implement mode's dispatch wording names the upstream
// `mattpocock-skills:implement` skill (the ref the dispatch row now resolves to),
// never the retired tdd alias.
//
// Module-level exports are types / the declared constant data / the class — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

/** The per-dispatch slot values — one entry per declared template token. */
export interface TemplateValues {
  readonly [name: string]: string;
}

/** One token declaration — a round-context/return zone slot the dispatch fills. */
export interface TemplateToken {
  /** The token name — the `{{NAME}}` slot spelling. */
  name: string;
  /** The zone the token belongs to (shell / return / round-context). */
  zone: string;
}

/** One per-return-format block — the `## Return` zone's declared variants. */
export interface ReturnZone {
  [format: string]: readonly string[];
}

/** The work-modes of the dispatch table — the ROLE values (fix's spec/plan face is
 *  the docs-fix mode; review covers task/branch/spec/plan + branch-review). */
export type WorkMode = "implement" | "fix" | "review" | "docs-fix";

/** One dispatch-table row — a mode's fixed prefix + its reduced dynamic tail. */
export interface ModePromptRow {
  /** The work-mode identity (the ROLE vocabulary). */
  mode: WorkMode;
  /** The mode's FIXED prefix — its instruction shell + the `## Handoff schema`
   *  section (with the {{HANDOFF_SCHEMA}} slot at the tail — the injected
   *  writable-subset fence): byte-identical for every dispatch of the mode. */
  shell: readonly string[];
  /** The mode's REDUCED round-context subset — the only dynamic region; a key
   *  whose value is empty is not emitted (空值键不发). */
  roundContext: readonly string[];
}

/** The template prompt data plane — the per-mode dispatch table + the single return
 *  contract + the token registry + the clause partials. */
export interface TemplatePrompt {
  $version: number;
  /** The mode 分派表 — one row per work-mode (§3.5). */
  modes: Readonly<Record<WorkMode, ModePromptRow>>;
  /** The `## Return` zone — the single block contract (v1.9). */
  return: ReturnZone;
  /** The token registry — the union across all modes' round contexts + the shell's
   *  schema slot (the gate's declared list). */
  tokens: readonly TemplateToken[];
  clauses: Readonly<Record<string, string>>;
}

/** One review guide row — the criteria of one review family (task / branch). */
export interface ReviewGuideRow {
  /** The lens vocabulary — the finding lens labels the review may carry. */
  lensEnum: readonly string[];
  /** The reference face the review judges. */
  ref: string;
  /** The axes guide prose — the four axes + the verification-evidence duty. */
  axesGuide: string;
}

/** The review criteria — the task/branch axes guides (P4 typed data). */
export type ReviewGuides = Readonly<Record<"task" | "branch", ReviewGuideRow>>;

/** The nominal fixed-frame items shared by every mode shell: the fixed-region
 *  promise + the scope lock (byte-identical words, one per mode shell). */
const FRAME_ITEMS: readonly string[] = [
  "1. **The fixed regions of this prompt — everything above `## Round context` — are this mode's dispatch contract, byte-identical for every dispatch of this mode; `## Round context` (the final section) is the only dynamic region.** Wherever this contract names a symbol, resolve the real value from `## Round context`; nothing real rides above it.",
  "2. **Scope lock (every mode):** consume only this round's inputs listed in `## Round context`. Do **not** read the full plan file. Implement exactly what the brief specifies — no extra features, no tangential refactors, no scope creep beyond the brief's Files/Interfaces/Steps.",
];

/** The discipline-clause cells shared by every mode shell (the `{{> cl:…}}` partials
 *  resolve from the single clause container — the same bytes, one per mode shell). */
const LICENSE_ITEMS: readonly string[] = [
  "",
  "**Discipline clauses (single-source; bind this mode):**",
  "- {{> cl:english-comments}}",
  "- {{> cl:eof-newline}}",
  "- {{> cl:no-full-tree-find}}",
  "- {{> cl:bash-stall-limit}}",
  "- {{> cl:plan-freeze}}",
  "- {{> cl:atomic-commit}}",
  "- {{> cl:self-validate}}",
  "- {{> cl:changed-surface}}",
];

/** The `## Handoff schema` section — the injected writable-subset fence at every
 *  mode shell's tail (the {{HANDOFF_SCHEMA}} slot; the face's sets differ per mode,
 *  so the section's bytes are fixed per mode — §3.5 prefix-cache grouping). */
const SCHEMA_SECTION: readonly string[] = ["", "## Handoff schema", "", "{{HANDOFF_SCHEMA}}"];

/** The implement mode's fixed prefix — header + instructions + the schema section. */
const IMPLEMENT_SHELL: readonly string[] = [
  "# CDD dispatch — implement round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  "3. **implement:** read `INPUT_TASK` (the task brief) and `INPUT_RULES` (the plan constraints). `SCOPE` is this round's group key (the CLI `--tasks` string — the canonical group identity); `INPUT_TASK` is one file holding every `### Task N:` section of the group — implement **ALL sections**, never a subset. `CONFIRMED_SEAMS` listed in the brief → apply them when invoking the implementation approach — no re-negotiation; otherwise propose the test boundaries in the report, then invoke **`mattpocock-skills:implement`**. Write the handoff draft at `OUTPUT_HANDOFF` per `## Handoff schema` BEFORE the return block: declare `status` (APPROVED once applied, or BLOCKED with `failure_category`), `artifacts` (the brief / report / test_evidence paths — file pointers, never inline content), `commits` (`base` = the brief's `TASK_BASE`; `head` = `git rev-parse HEAD`), and `changes[]` (every changed file + reason).",
  "4. **Evidence gate:** write the test-evidence file (`tasks-{SCOPE}-test-evidence.json` under `WORKSPACE_DIR`) per the `test-evidence` schema in `## Handoff schema`: `command`, `exit_code`, `passed`, `warnings_count`, and the `typecheck` item (`command`/`exit_code`/`passed`, isomorphic with the exec fields); include `behavior_change` when applicable. Update the implementer report at the path from the brief after verification. The engine reads the evidence file back after you exit: a missing or schema-violating evidence file rewrites the draft to `status: BLOCKED` (exit 1). Report bodies, test stdout, and diff text live in files only — never in the return.",
  "5. **Commit contract:** `base` = the brief's `TASK_BASE`. When TDD/verification already produced one or more conventional commits covering this round's scope, set `head` = `git rev-parse HEAD` — do not create duplicate commits; otherwise create **one** conventional commit (`feat:` / `fix:` / `refactor:` / …) with subject aligned to the round — no attribution / co-author / AI-generation trailers — then `head` = `git rev-parse HEAD`. Uncommitted changes at return → `status: BLOCKED`; only commit changes within this round's scope — out-of-scope uncommitted changes at return → `status: BLOCKED` (the engine rewrites the handoff to BLOCKED and surfaces the generic uncommitted-changes reason on stderr `CDD_BLOCKED:`; the changed-surface audit records committed off-ledger files in the handoff's `notes`).",
  ...LICENSE_ITEMS,
  ...SCHEMA_SECTION,
];

const FIX_SHELL: readonly string[] = [
  "# CDD dispatch — fix round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  "3. **fix:** read `INPUT_FINDINGS` (the open findings) and — task rounds — `INPUT_TASK` (the task brief, for context only). Fix ALL findings — blockers, warns, and nits — verifying against `INPUT_FINDINGS` that none remain open before returning. `commits.base` = `FIX_BASE` (this round's fix anchor — the prior handoff's `commits.head`); `commits.head` = `git rev-parse HEAD` (full 40-char SHA, never `--short`). No fix-scope diff relative to `FIX_BASE` → no commit (keep `head` unchanged). Fix + write the handoff draft at `OUTPUT_HANDOFF` per `## Handoff schema` in one process; a draft write failure → return block `status: BLOCKED`; retry = full mode re-run (idempotent).",
  "4. **Evidence gate:** write the test-evidence file (`tasks-{SCOPE}-test-evidence.json` under `WORKSPACE_DIR`) per the `test-evidence` schema in `## Handoff schema`: `command`, `exit_code`, `passed`, `warnings_count`, and the `typecheck` item (`command`/`exit_code`/`passed`, isomorphic with the exec fields); include `behavior_change` when applicable. Update the implementer report at the path from the brief after verification. The engine reads the evidence file back after you exit: a missing or schema-violating evidence file rewrites the draft to `status: BLOCKED` (exit 1). Report bodies, test stdout, and diff text live in files only — never in the return.",
  "5. **Commit contract:** `base` = `FIX_BASE`; the fix commits its scope as **one** conventional commit (`fix:` / `refactor:` / …) with subject aligned to the round — no attribution / co-author / AI-generation trailers, no duplicate commits when verification already produced the covering commit. Uncommitted changes at return → `status: BLOCKED`; only commit changes within this round's scope — out-of-scope uncommitted changes at return → `status: BLOCKED` (the engine rewrites the handoff to BLOCKED and surfaces the generic uncommitted-changes reason on stderr `CDD_BLOCKED:`; the changed-surface audit records committed off-ledger files in the handoff's `notes`).",
  ...LICENSE_ITEMS,
  ...SCHEMA_SECTION,
];

const REVIEW_SHELL: readonly string[] = [
  "# CDD dispatch — review round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  "3. **review:** review the axes in `INPUT_CRITERIA` against the reference in `INPUT_RANGE`. Write the findings into the handoff draft at `OUTPUT_HANDOFF` per `## Handoff schema` (never print them to stdout); every finding MUST carry its `lens` label (one of `INPUT_LENS`); an empty `findings` array = approved. The engine reads the draft back and derives the round's conclusion from the findings (blocker → CHANGES_REQUESTED · warn/nit → REVIEW_FIX · none → APPROVED) — a review never declares its own status.",
  ...LICENSE_ITEMS,
  ...SCHEMA_SECTION,
];

const DOCS_FIX_SHELL: readonly string[] = [
  "# CDD dispatch — docs-fix round",
  "",
  "## Instructions",
  "",
  ...FRAME_ITEMS,
  "3. **docs-fix:** apply the fixes from `INPUT_FINDINGS` (all severities) directly to `INPUT_DOC`, removing fixed findings; record the doc path in `artifacts` (`doc` = the exact `INPUT_DOC` path); an empty `findings` array = all findings fixed. `commits.base` = `FIX_BASE`; `commits.head` = `git rev-parse HEAD`. Fix + write the handoff draft at `OUTPUT_HANDOFF` per `## Handoff schema` in one process — the engine derives the round's conclusion from the residual findings; a draft write failure → return block `status: BLOCKED`; retry = full mode re-run (idempotent).",
  ...LICENSE_ITEMS,
  ...SCHEMA_SECTION,
];

/** The mode 分派表 — one row per work-mode (§3.5): the mode's fixed prefix + its
 *  reduced round-context subset. */
const MODE_PROMPTS: Readonly<Record<WorkMode, ModePromptRow>> = {
  implement: {
    mode: "implement",
    shell: IMPLEMENT_SHELL,
    roundContext: [
      "## Round context",
      "",
      "- `ROLE`: {{ROLE}}",
      "- `SCOPE`: {{SCOPE}}",
      "- `INPUT_TASK`: {{INPUT_TASK}}",
      "- `INPUT_RULES`: {{INPUT_RULES}}",
      "- `OUTPUT_HANDOFF`: {{OUTPUT_HANDOFF}}",
      "- `WORKSPACE_DIR`: {{WORKSPACE_DIR}}",
      "- `WORKSPACE_ID`: {{WORKSPACE_ID}}",
    ],
  },
  fix: {
    mode: "fix",
    shell: FIX_SHELL,
    roundContext: [
      "## Round context",
      "",
      "- `ROLE`: {{ROLE}}",
      "- `SCOPE`: {{SCOPE}}",
      "- `INPUT_TASK`: {{INPUT_TASK}}",
      "- `INPUT_RULES`: {{INPUT_RULES}}",
      "- `INPUT_FINDINGS`: {{INPUT_FINDINGS}}",
      "- `FIX_BASE`: {{FIX_BASE}}",
      "- `OUTPUT_HANDOFF`: {{OUTPUT_HANDOFF}}",
      "- `WORKSPACE_DIR`: {{WORKSPACE_DIR}}",
      "- `WORKSPACE_ID`: {{WORKSPACE_ID}}",
    ],
  },
  review: {
    mode: "review",
    shell: REVIEW_SHELL,
    roundContext: [
      "## Round context",
      "",
      "- `ROLE`: {{ROLE}}",
      "- `SCOPE`: {{SCOPE}}",
      "- `INPUT_RANGE`: {{INPUT_RANGE}}",
      "- `INPUT_CRITERIA`: {{INPUT_CRITERIA}}",
      "- `INPUT_LENS`: {{INPUT_LENS}}",
      "- `INPUT_PLAN`: {{INPUT_PLAN}}",
      "- `OUTPUT_HANDOFF`: {{OUTPUT_HANDOFF}}",
      "- `WORKSPACE_DIR`: {{WORKSPACE_DIR}}",
      "- `WORKSPACE_ID`: {{WORKSPACE_ID}}",
    ],
  },
  "docs-fix": {
    mode: "docs-fix",
    shell: DOCS_FIX_SHELL,
    roundContext: [
      "## Round context",
      "",
      "- `ROLE`: {{ROLE}}",
      "- `SCOPE`: {{SCOPE}}",
      "- `INPUT_DOC`: {{INPUT_DOC}}",
      "- `INPUT_FINDINGS`: {{INPUT_FINDINGS}}",
      "- `FIX_BASE`: {{FIX_BASE}}",
      "- `OUTPUT_HANDOFF`: {{OUTPUT_HANDOFF}}",
      "- `WORKSPACE_DIR`: {{WORKSPACE_DIR}}",
      "- `WORKSPACE_ID`: {{WORKSPACE_ID}}",
    ],
  },
};

/** The `## Return` zone — the single block contract (v1.9: RETURN_JSON and DOCS_FIX
 *  are retired — the child's content lives in the draft file, the block is the
 *  three-line pointer every mode returns). */
const RETURN_ZONE: ReturnZone = {
  RETURN_STDOUT_BLOCK: [
    "## Return",
    "",
    "Return **exactly 3 lines** to stdout — make this block the **final** output; nothing may follow it (stream-json harnesses parse the last block):",
    "",
    "```",
    "status: <APPROVED|BLOCKED>",
    "commits: base=<sha> head=<sha>",
    "artifacts: brief=<path> report=<path> test_evidence=<path>",
    "```",
    "",
    "The return format is **RETURN_STDOUT_BLOCK** (every round — one contract): the handoff content — findings, notes, changes, evidence — lives in the draft file at `OUTPUT_HANDOFF` (see `## Round context`), which the engine reads back and materializes; this block is the three-line pointer only. Review-family and docs-fix rounds state `status: APPROVED` (their conclusion derives from the draft's findings — never printed); work rounds state the concluding status. The engine appends the 4th `counters:` line and the 5th derived `next:` suggestion line (C5) — the agent never emits either. Report bodies, test stdout, and diff text live in files only — never in the return. Any non-`APPROVED` status line (e.g. `NEEDS_CONTEXT`) is collapsed by the engine to `BLOCKED` + exit 1.",
  ],
};

/** The token registry — the union across every mode's round context + the shell's
 *  schema slot (the v1.8 规整命名 vocabulary; the assembly face supplies every
 *  declared slot, empty where the mode does not consume it — the round-context
 *  renderer drops the empty-valued lines). */
const TOKENS: readonly TemplateToken[] = [
  { name: "FIX_BASE", zone: "round-context" },
  { name: "HANDOFF_SCHEMA", zone: "shell" },
  { name: "INPUT_CRITERIA", zone: "round-context" },
  { name: "INPUT_DOC", zone: "round-context" },
  { name: "INPUT_FINDINGS", zone: "round-context" },
  { name: "INPUT_LENS", zone: "round-context" },
  { name: "INPUT_PLAN", zone: "round-context" },
  { name: "INPUT_RANGE", zone: "round-context" },
  { name: "INPUT_RULES", zone: "round-context" },
  { name: "INPUT_TASK", zone: "round-context" },
  { name: "OUTPUT_HANDOFF", zone: "round-context" },
  { name: "ROLE", zone: "round-context" },
  { name: "SCOPE", zone: "round-context" },
  { name: "WORKSPACE_DIR", zone: "round-context" },
  { name: "WORKSPACE_ID", zone: "round-context" },
];

/** The clause partials — the `{{> cl:…}}` forms of the discipline clauses. */
export const CLAUSES = {
  "cl:english-comments":
    "Write code comments and shipped prose in English only — English-primary (no other-language comment blocks, no translated mirrors).",
  "cl:eof-newline":
    "Every text file must end with exactly one newline (EOF newline): no missing final newline and no trailing blank lines.",
  "cl:no-full-tree-find":
    "Never run an unbounded full-tree `find` over a large directory and never bare-read a large file — constrain to explicit paths with `maxdepth`/`-path`, or read only the needed range.",
  "cl:bash-stall-limit":
    "If a Bash command stalls without progress for more than 10 minutes, terminate it and substitute an equivalent, lighter command.",
  "cl:plan-freeze":
    "Approved plan/spec files are frozen — zero modification authority; any change needed is reported to the orchestrator through findings, never edited in place.",
  "cl:atomic-commit":
    "Commit each round's change as one atomic conventional commit scoped to the round — no mixed or out-of-scope content, no AI-generation trailers.",
  "cl:self-validate":
    "Self-validate before returning: run the validation/checks your change requires and record the evidence (command + exit code + result) in the report.",
  "cl:changed-surface":
    "Changed-surface bookkeeping: implement/fix rounds declare every file they changed in the handoff `changes[]` ledger (file + reason each). The engine reconciles `git diff <base>..HEAD` against it — files off the ledger are surfaced (warn + notes), never blocked; the review scope axis judges them (normal finding → fix loop).",
} as const;

/** The dispatch-prompt data plane — the typed template-contract surface. $version 5
 *  marks the v1.8 分派表 reparametrization (per-mode fixed prefixes + reduced round
 *  contexts + the INPUT_/OUTPUT_/WORKSPACE_/FIX_BASE/ROLE/SCOPE vocabulary) over the
 *  v1.9 single-return + schema-injection base (§3.5 · §3.6). */
export const TEMPLATE_PROMPT = {
  $version: 5,
  modes: MODE_PROMPTS,
  return: RETURN_ZONE,
  tokens: TOKENS,
  clauses: CLAUSES,
} as const satisfies TemplatePrompt;

/** The review criteria — the task/branch axes guides (P4 typed data). The P5
 *  forbidden "parallel sub-agents" wording is deleted from the guides. */
export const REVIEWS = {
  task: {
    lensEnum: ["standards", "spec", "buildability"],
    ref: "TASK_BASE..HEAD",
    axesGuide:
      "Standards axis (repo coding standards + code-review smell baseline) + Spec axis (task brief / plan requirements) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — `tsc --noEmit`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): cross-check the handoff's `changes[]` ledger against the actual `git diff <base>..HEAD` fileset — any changed file with no ledger entry and no brief-seam attribution is a candidate finding (severity by your judgment; warn-level booking gaps the engine flagged can surface here as blockers when they expose out-of-brief changes). Single agent, four axes.",
  },
  branch: {
    lensEnum: ["standards", "spec", "buildability"],
    ref: "BASE..HEAD",
    axesGuide:
      "Same four axes as task (branch-wide health: diff BASE..HEAD + plan conformance) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — `tsc --noEmit`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): branch review IS the full diff — every changed file must be attributable to a finding, a plan requirement, or the reviewed intent; unrelated surface = candidate finding (severity by your judgment), normal finding → fix loop.",
  },
} as const satisfies ReviewGuides;

/**
 * The template assembler — the ONE renderer over the typed template-prompt data
 * plane. Construction reads the typed contract (the module's declared data —
 * no file reads, no second copy). render(values) selects the mode row by the
 * ROLE value — the mode's fixed prefix + the single return contract + the mode's
 * reduced round context (empty-value keys not emitted).
 */
export class TemplateAssembler {
  readonly #contract: TemplatePrompt;
  readonly #reviews: ReviewGuides;

  constructor() {
    this.#contract = TEMPLATE_PROMPT;
    this.#reviews = REVIEWS;
  }

  /** The return formats the contract declares — the single block contract (v1.9:
   *  RETURN_JSON / DOCS_FIX retired). */
  returnFormats(): readonly string[] {
    return Object.keys(this.#contract.return);
  }

  /** The tokens the contract declares (the union across every mode — all zones). */
  declaredTokens(): readonly string[] {
    return this.#contract.tokens.map((token) => token.name);
  }

  /** The work-modes of the dispatch table — the ROLE vocabulary. */
  workModes(): readonly WorkMode[] {
    return Object.keys(this.#contract.modes) as WorkMode[];
  }

  /** The review criteria of one family — the typed axes guide the assembly face
   *  references (the task/branch INPUT_CRITERIA source). */
  reviewGuide(kind: "task" | "branch"): ReviewGuideRow {
    return this.#reviews[kind];
  }

  /** Assemble the full dispatch template for a role with the slot values — the
   *  mode's fixed prefix + the single return contract + the mode's reduced round
   *  context (empty-value keys omitted — 空值键不发). */
  render(values: TemplateValues): string {
    this.#gate(values);
    const row = this.#contract.modes[values.ROLE as WorkMode];
    const zones: Record<string, string> = {
      shell: this.#joinLines(row.shell),
      return: this.#joinLines(this.#contract.return.RETURN_STDOUT_BLOCK),
      "round-context": this.#contextLines(row, values),
    };
    return this.#fill([zones.shell, zones.return, zones["round-context"]].join("\n\n"), values);
  }

  #joinLines(lines: readonly string[]): string {
    return lines.join("\n");
  }

  /** The reduced round-context section — the mode's subset, a key whose value is
   *  empty omitted (only present facts land in the dynamic region). */
  #contextLines(row: ModePromptRow, values: TemplateValues): string {
    const lines: string[] = [];
    for (const line of row.roundContext) {
      const slot = line.match(/\{\{([A-Z0-9_]+)\}\}/)?.[1];
      if (slot !== undefined && values[slot] === "") continue;
      lines.push(line);
    }
    return lines.join("\n");
  }

  /** The hard gates — a known ROLE, every declared token supplied (empty allowed —
   *  a mode's non-consumed slots are legitimately empty and merely not emitted), no
   *  undeclared values, the single return contract declared. */
  #gate(values: TemplateValues): void {
    const role = values.ROLE;
    const row = role === undefined ? undefined : this.#contract.modes[role as WorkMode];
    if (row === undefined) {
      throw new Error(
        `template work-mode not declared: ${role === undefined ? "(missing ROLE)" : role}`,
      );
    }
    for (const token of this.#contract.tokens) {
      if (values[token.name] === undefined) {
        throw new Error(`template token ${token.name} (${token.zone}) has no value`);
      }
    }
    for (const name of Object.keys(values)) {
      if (!this.#contract.tokens.some((token) => token.name === name)) {
        throw new Error(`template value provided for undeclared token ${name}`);
      }
    }
  }

  /** Slot resolution — the `{{> cl:…}}` clause partials resolve from the contract's
   *  clauses container, the `{{TOKEN}}` slots from the values; any unresolved form
   *  (a clause absent from the container, a slot with no value) is a hard error. */
  #fill(text: string, values: TemplateValues): string {
    return text
      .replace(/\{\{> cl:([A-Za-z0-9-]+)\}\}/g, (_match, name: string) => {
        const clause = this.#contract.clauses[`cl:${name}`];
        if (clause === undefined) {
          throw new Error(`template clause cl:${name} not declared`);
        }
        return clause;
      })
      .replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, name: string) => {
        const value = values[name];
        if (value === undefined) {
          throw new Error(`template slot not resolved: ${name}`);
        }
        return value;
      });
  }
}
