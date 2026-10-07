// packages/cdd-engine/src-next/render/templates.ts
// T21 — the template-contract typed surface: the template-contract JSON's data-plane
// home PLUS the TemplateAssembler (one module, one renderer). The dispatch prompt
// data (the shell frame zones · the return-format blocks · the round-context zone ·
// the token registry · the clause partials) and the review criteria (the task/branch
// axes guide — P4) are typed constant data here, imported never parsed:
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

/** The template prompt data plane — the declared zones + segment order + registry. */
export interface TemplatePrompt {
  $version: number;
  skeleton: {
    sections: readonly string[];
    segments: Readonly<Record<string, readonly string[]>>;
    order: readonly string[];
  };
  sections: {
    shell: readonly string[];
    return: ReturnZone;
    "round-context": readonly string[];
  };
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

/** The shell frame zone — byte-fixed for every round/mode (the P5 M1 supersede
 *  updates the implement-mode invoke wording to the `mattpocock-skills:implement`
 *  skill — the dispatch row's ref). */
const SHELL: readonly string[] = [
  "# CDD dispatch — CLI session",
  "",
  "## Instructions",
  "",
  "1. **`## Round context` — the final section — is the only dynamic region of this prompt.** Every per-dispatch value lives there; this shell and `## Return` are the fixed dispatch contract, byte-identical for every round and mode. Wherever this contract names a symbol (`BRIEF`, `HANDOFF_TARGET`, `REVIEW_REFERENCE`, …), resolve the real value from `## Round context`; nothing real rides above it. The `MODE` in `## Round context` selects this round's rules below.",
  "2. **Scope lock (every mode):** consume only this round's inputs listed in `## Round context`. Do **not** read the full plan file. Implement exactly what the brief specifies — no extra features, no tangential refactors, no scope creep beyond the brief's Files/Interfaces/Steps.",
  "3. **`implement`:** read only the task brief at `BRIEF` and the plan constraints at `CONSTRAINTS`. `DISPATCH_UNIT` is this round's group key (the CLI `--tasks` string — the canonical group identity); `BRIEF` is one file holding every `### Task N:` section of the group — implement **ALL sections**, never a subset. `CONFIRMED_SEAMS` listed in the brief → apply them when invoking the implementation approach — no re-negotiation; otherwise propose the test boundaries in the report, then invoke **`mattpocock-skills:implement`**. This mode does not write a handoff — the engine materializes `tasks-{DISPATCH_UNIT}-implement.json` from your return block three lines + the brief's `TASK_BASE` + `git HEAD` (the engine is the single authority for `commits` and for re-emitting your return block).",
  "4. **`fix`:** read the open findings at `FINDINGS` and the task brief at `BRIEF` (paths only — do not paste review bodies into the prompt). Fix ALL findings — blockers, warns, and nits — and remove fixed findings from the handoff's `findings[]`. `commits.base` = `FIXED_POINT` (this round's `FIX_BASE` — the prior handoff's `commits.head`); `commits.head` = `git rev-parse HEAD` (full 40-char SHA, never `--short`). No fix-scope diff relative to `FIXED_POINT` → no commit (keep `head` unchanged). Implement + handoff in one process; a handoff write failure → return block `status: BLOCKED`; retry = full mode re-run (idempotent).",
  "5. **`review`:** review the axes in `REVIEW_AXES` against the reference in `REVIEW_REFERENCE`. Every finding MUST carry its `lens` label (one of `REVIEW_LENS_GUIDE`); an empty `findings` array = approved. The `returnFormat` named in `## Return` selects the return contract: RETURN_JSON → findings-only JSON on stdout; RETURN_STDOUT_BLOCK → collect findings into the handoff's `findings[]` (do not print them), then the three-line return block only.",
  "6. **`docs`:** apply fixes directly to `DOC` per `FINDINGS` (all severities), removing fixed findings; `artifacts` records the doc path and `doc_path` = the exact `DOC` path.",
  "7. **Evidence gate:** before returning, write the test-evidence file under `WORKSPACE` (`tasks-{DISPATCH_UNIT}-test-evidence.json` — the canonical task-family form the engine reads back byte-identically) with at least `command`, `exit_code`, `passed`, and `warnings_count`, plus the `typecheck` item (`command`/`exit_code`/`passed`, isomorphic with the exec fields); include `behavior_change` when applicable. The engine reads it back after you exit: a missing or incomplete `typecheck` item (missing any of its three fields), and a `behavior_change: true` round missing `command`/`passed`/`exit_code`, both override the handoff to `status: BLOCKED` (exit 1) — otherwise only a WARN note attaches. Update the implementer report at the path from the brief after verification. Report bodies, test stdout, and diff text live in files only — never in the return.",
  "8. **Commit contract (base/head):** `base` = the brief's `TASK_BASE` (implement) or `FIXED_POINT` (fix — a review's reviewed range). When TDD/verification already produced one or more conventional commits covering this round's scope, set `head` = `git rev-parse HEAD` — do not create duplicate commits; otherwise create **one** conventional commit (`feat:` / `fix:` / `refactor:` / …) with subject aligned to the round — no attribution / co-author / AI-generation trailers — then `head` = `git rev-parse HEAD`. Uncommitted changes at return → `status: BLOCKED`. Only commit changes within this round's scope; out-of-scope uncommitted changes at return → `status: BLOCKED` (the engine rewrites the handoff to BLOCKED and surfaces the generic uncommitted-changes reason on stderr `CDD_BLOCKED:`; the changed-surface audit records committed off-ledger files in the handoff's `notes`; the `blocker:` declaration channel is retired with the return-block column).",
  "9. **Discipline clauses (single-source; bind every mode):**",
  "- {{> cl:english-comments}}",
  "- {{> cl:eof-newline}}",
  "- {{> cl:no-full-tree-find}}",
  "- {{> cl:bash-stall-limit}}",
  "- {{> cl:plan-freeze}}",
  "- {{> cl:atomic-commit}}",
  "- {{> cl:self-validate}}",
  "- {{> cl:changed-surface}}",
  "",
  "## Handoff",
  "",
  "Write/update the handoff JSON at `HANDOFF_TARGET` (see `## Round context`) per the schema below. The `HANDOFF_WRITE_GATE` entry — `### HANDOFF_WRITE_GATE` in `## Round context` — states this round's write protocol; follow it literally before returning. Work-type rounds (implement/fix) declare `status` (APPROVED once applied, or BLOCKED with `failure_category` — the reason channel); review-family rounds write findings, not status — the engine derives status from findings. `artifacts` points at files, never inline content. Self-validate before returning (`jq .` on the written handoff → `phase`/`artifacts`/`findings` non-null); a non-parseable or schema-violating handoff is rewritten BLOCKED by the engine.",
];

/** The `## Return` zone variants — the per-return-format blocks. */
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
    "The `returnFormat` is **RETURN_STDOUT_BLOCK**: review-family rounds (task/branch) collect findings into `HANDOFF_TARGET` `findings[]` (see `## Round context` — do not print them), then output this block as the ONLY stdout content; `implement` rounds return this block directly. The engine appends the 4th `counters:` line and the 5th derived `next:` suggestion line (C5) — the agent never emits either. Report bodies, test stdout, and diff text live in files only — never in the return. Any non-`APPROVED` status line (e.g. `NEEDS_CONTEXT`) is collapsed by the engine to `BLOCKED` + exit 1.",
  ],
  RETURN_JSON: [
    "## Return",
    "",
    "This review's `returnFormat` is **RETURN_JSON** — return findings ONLY as a JSON object:",
    "",
    '`{"findings":[{ "lens": "<one of REVIEW_LENS_GUIDE — see ## Round context>", "severity": "blocker|warn|nit", "section": "...", "line": 0, "summary": "...", "fix": "..." }]}`',
    "",
    "Every finding MUST carry its `lens` label (prevents axis mixing); empty `findings` array = approved; no additional prose.",
  ],
  DOCS_FIX: [
    "## Return",
    "",
    "Your return IS the handoff written to `HANDOFF_TARGET` (see `## Round context`) — **the engine reads the file, not your stdout**. Return **no additional prose**; empty `findings` array = all findings fixed. Write/update `HANDOFF_TARGET` per the schema in the shell above BEFORE exiting — leaving it unwritten is BLOCKED (runner exit 1).",
  ],
};

/** The `## Round context` zone — the only dynamic zone of the prompt. */
const ROUND_CONTEXT: readonly string[] = [
  "## Round context",
  "",
  "- `MODE`: {{MODE}}",
  "- `DISPATCH_UNIT`: {{DISPATCH_UNIT}}",
  "- `BRIEF`: {{BRIEF}}",
  "- `CONSTRAINTS`: {{CONSTRAINTS}}",
  "- `FINDINGS`: {{FINDINGS}}",
  "- `FIXED_POINT`: {{FIXED_POINT}}",
  "- `WORKSPACE`: {{WORKSPACE}}",
  "- `WORKSPACE_SLUG`: {{WORKSPACE_SLUG}}",
  "- `REVIEW_TYPE`: {{REVIEW_TYPE}}",
  "- `REVIEW_REFERENCE`: {{REVIEW_REFERENCE}}",
  "- `REVIEW_LENS_GUIDE`: {{REVIEW_LENS_GUIDE}}",
  "- `REVIEW_AXES`: {{REVIEW_AXES}}",
  "- `REVIEW_PLAN_LINE`: {{REVIEW_PLAN_LINE}}",
  "- `DOC`: {{DOC}}",
  "- `HANDOFF_TARGET`: {{HANDOFF_TARGET}}",
  "",
  "### HANDOFF_WRITE_GATE",
  "",
  "{{HANDOFF_WRITE_GATE}}",
];

/** The token registry — every declared slot, with its zone. */
const TOKENS: readonly TemplateToken[] = [
  { name: "BRIEF", zone: "round-context" },
  { name: "CONSTRAINTS", zone: "round-context" },
  { name: "DISPATCH_UNIT", zone: "round-context" },
  { name: "DOC", zone: "round-context" },
  { name: "FINDINGS", zone: "round-context" },
  { name: "FIXED_POINT", zone: "round-context" },
  { name: "HANDOFF_TARGET", zone: "round-context" },
  { name: "HANDOFF_WRITE_GATE", zone: "round-context" },
  { name: "MODE", zone: "round-context" },
  { name: "REVIEW_AXES", zone: "round-context" },
  { name: "REVIEW_LENS_GUIDE", zone: "round-context" },
  { name: "REVIEW_PLAN_LINE", zone: "round-context" },
  { name: "REVIEW_REFERENCE", zone: "round-context" },
  { name: "REVIEW_TYPE", zone: "round-context" },
  { name: "RETURN_FORMAT", zone: "return" },
  { name: "RETURN_STDOUT_BLOCK", zone: "return" },
  { name: "WORKSPACE", zone: "round-context" },
  { name: "WORKSPACE_SLUG", zone: "round-context" },
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

/** The dispatch-prompt data plane — the typed template-contract surface. */
export const TEMPLATE_PROMPT = {
  $version: 3,
  skeleton: {
    sections: ["Instructions", "Handoff", "Return", "Round context"],
    segments: {
      shell: ["Instructions", "Handoff"],
      return: ["Return"],
      "round-context": ["Round context"],
    },
    order: ["shell", "return", "round-context"],
  },
  sections: {
    shell: SHELL,
    return: RETURN_ZONE,
    "round-context": ROUND_CONTEXT,
  },
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
      "Standards axis (repo coding standards + code-review smell baseline) + Spec axis (task brief / plan requirements) + Buildability axis (the reviewer explicitly runs the repository's typecheck command — `tsc --noEmit`, or the repo equivalent — AND its test command; every buildability finding self-reports the dual evidence, both commands ran) + Scope axis (changed-surface reasonableness): cross-check the handoff's `changes[]` ledger against the actual `git diff <base>..HEAD` fileset — any changed file with no ledger entry and no brief-seam attribution is a candidate finding (severity by your judgment; the writing-plans self-check applies where the plan could be made simpler); warn-level booking gaps the engine flagged can surface here as blockers when they expose out-of-brief changes. Single agent, four axes.",
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
 * no file reads, no second copy).
 */
export class TemplateAssembler {
  readonly #contract: TemplatePrompt;
  readonly #reviews: ReviewGuides;

  constructor() {
    this.#contract = TEMPLATE_PROMPT;
    this.#reviews = REVIEWS;
  }

  /** The return formats the contract declares. */
  returnFormats(): readonly string[] {
    return Object.keys(this.#contract.sections.return);
  }

  /** The tokens the contract declares (all zones). */
  declaredTokens(): readonly string[] {
    return this.#contract.tokens.map((token) => token.name);
  }

  /** The review criteria of one family — the typed axes guide the assembly face
   *  references (the task/branch REVIEW_AXES source). */
  reviewGuide(kind: "task" | "branch"): ReviewGuideRow {
    return this.#reviews[kind];
  }

  /** Assemble the full dispatch template for a return format with the slot values. */
  render(returnFormat: string, values: TemplateValues): string {
    this.#gate(returnFormat, values);
    const zones: Record<string, string> = {
      shell: this.#joinLines(this.#contract.sections.shell),
      return: this.#joinLines(this.#contract.sections.return[returnFormat]),
      "round-context": this.#joinLines(this.#contract.sections["round-context"]),
    };
    const ordered = this.#contract.skeleton.order.map((segment) => zones[segment]);
    return this.#fill(ordered.join("\n\n"), values);
  }

  #joinLines(lines: readonly string[]): string {
    return lines.join("\n");
  }

  /** The hard gates — every declared token supplied (empty allowed: a dispatch's
   *  optional slots like FIXED_POINT / REVIEW_TYPE are legitimately empty), no
   *  undeclared values, known format. */
  #gate(returnFormat: string, values: TemplateValues): void {
    if (this.#contract.sections.return[returnFormat] === undefined) {
      throw new Error(`template return format not declared: ${returnFormat}`);
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
