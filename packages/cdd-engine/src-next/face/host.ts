// packages/cdd-engine/src-next/face/host.ts
// T21 — the harness-contract typed surface: the harness-contract JSON's data-plane
// home as one typed constant module. The new tree reads zero config files — the
// host-adaptation contract (host detection · dispatch · refs) lives here and is
// imported, never parsed:
//
//   · HOSTS     — the per-harness rows (cli / invoke / promptForm / output / ship /
//     detect / install / cache). The host-marker closure is single-sourced HERE: the
//     detect rows are the only copy of the marker env keys (the channel audit derives
//     the env whitelist from them — never a second declaration). The promptForm
//     column (§3.5) is the prompt-position semantics data contract — how the
//     skill-ref enters the child prompt (ref-prefixed | plain).
//   · DISPATCH  — the dispatch table: the skill-ref (or URC prose) each phase
//     resolves to. M1 supersede (P5): the implement slot names the upstream
//     `mattpocock-skills:implement` skill, never the retired tdd alias.
//   · REFS      — the per-harness slash reference forms (claude/cursor use the
//     `/namespace:skill` form; pi the flat `/skill:<bare>` form — the pi flat
//     namespace has no namespace-qualification syntax).
//
// P5 lands here: the forbidden parallel-sub-agents prose is deleted from the review
// dispatch rows (the task/branch rows carry their ref only) and the review
// criteria — the URC spec/plan axes + the writing-plans self-check + the
// verification-evidence duty — land in render/templates.ts (the axes guide's
// typed home). The `mattpocock-skills:implement` ref key is registered here.
//
// Module-level exports are types / the declared constant data — zero behavior-
// carrying bare functions (the plan's zero-bare-function discipline).

/** The harness ids the contract adapts. */
export type HostId = "claude" | "cursor" | "pi";

/** One host-detect row — the marker env key (+ the AI_AGENT match semantics). */
export interface HostDetectSpec {
  /** The marker env key the host detection reads. */
  env: string;
  /** pi-only: the AI_AGENT exact value the detection matches (`=== "value"`). */
  value?: string;
  /** claude-only: the AI_AGENT prefix the detection matches via startsWith. */
  aiAgentPrefix?: string;
}

/** One host-cache row — the prompt-cache mechanism facts. */
export interface HostCacheSpec {
  /** The cache mechanism (explicit hints / auto-prefix). */
  mechanism: string;
  /** The minimum token threshold; the `pending` literal is the not-yet-known marker. */
  minTokens: number | "pending";
  /** Explicit-hint face: the read/write budget multipliers + TTL (claude only). */
  readMultiplier?: number;
  /** Explicit-hint face: the write-budget multiplier (claude only). */
  writeMultiplier?: number;
  /** Explicit-hint face: the cache TTL in minutes (claude only). */
  ttlMinutes?: number;
  /** Whether the cache is observable to the engine. */
  observable: boolean;
}

/** The prompt-position semantics of a harness — HOW the skill-ref enters the child
 *  prompt (the §3.5 data contract, resolved by #childPrompt — the from-code-assumed
 *  prompt assembly becomes a per-host row). `ref-prefixed`: the slash ref prefixes
 *  the single prompt positional; `plain`: the child receives the prompt verbatim
 *  (no ref to prefix — the URC-prose rows). */
export type PromptForm = "ref-prefixed" | "plain";

/** One per-harness host row — the adaptation facts the engine + guards consume. */
export interface HostRow {
  /** The host harness CLI binary. */
  cli: string;
  /** The invoke flags prepended to the dispatch prompt. */
  invoke: string;
  /** The prompt-position semantics — how the skill-ref enters the child prompt. */
  promptForm: PromptForm;
  /** The harness output mode. */
  output: string;
  /** The ship status of the harness face. */
  ship: string;
  /** The detect row — the marker env key(+ semantics). */
  detect: HostDetectSpec;
  /** The per-package install banners (kairos self-install + upstream plugins);
   *  `"pending"` is the literal not-yet-known command. */
  install: Readonly<Record<string, readonly string[] | "pending">>;
  /** The prompt-cache facts. */
  cache: HostCacheSpec;
}

/** A review dispatch row — an object-shaped slot naming its ref key (the note face
 *  is deleted with the P5 forbidden prose; the review criteria live in the axes
 *  guide, render/templates.ts). */
export interface ReviewDispatchRow {
  /** The ref key the review phase dispatches to. */
  ref: string;
}

/**
 * The dispatch table — the phase/type → skill-ref (or URC prose) resolution.
 * v1.8 closeout: the spec/plan review criteria migrated to the template plane's
 * REVIEWS (render/templates.ts) — the dispatch review rows are the task/branch ref
 * keys only; a spec/plan review resolves no skill ref (the URC prose rides the
 * review prompt's criteria body).
 */
export interface DispatchTable {
  /** The implement phase's ref key (M1 supersede: mattpocock-skills:implement). */
  implement: string;
  /** The fix phase's ref key. */
  fix: string;
  /** The review phase rows — the task/branch ref keys (the spec/plan rows carry no
   *  skill ref — the review criteria live in the template plane). */
  review: Readonly<Record<"task" | "branch", ReviewDispatchRow>>;
}

/** The per-harness slash reference forms of one ref key. */
export type HostReferenceForm = Readonly<Record<HostId, string>>;

/** The full reference table — every `<pkg>:<skill>` cross-skill reference key. */
export type HostReferenceTable = Readonly<Record<string, HostReferenceForm>>;

/** The typed harness contract — hosts + dispatch + refs (one constant, the single
 *  harness-adaptation truth; zero `_doc`/`$schema` prose). */
export interface HostContract {
  hosts: Readonly<Record<HostId, HostRow>>;
  dispatch: DispatchTable;
  refs: HostReferenceTable;
}

/** The per-harness install banners — the kairos self-install + the upstream plugin
 *  install commands (the README upstream dependency table renders from these rows). */
export const INSTALL_ROWS = {
  kairos: [
    "claude plugin marketplace add oscaner/skills",
    "claude plugin install kairos@oscaner-skills",
  ],
  superpowers: [
    "claude plugin marketplace add obra/superpowers-marketplace",
    "claude plugin install superpowers@superpowers-marketplace",
  ],
  "mattpocock-skills": [
    "claude plugin marketplace add mattpocock/skills",
    "claude plugin install mattpocock-skills@mattpocock",
  ],
  impeccable: [
    "claude plugin marketplace add pbakaus/impeccable",
    "claude plugin install impeccable@impeccable",
  ],
} as const;

/** The per-harness host rows — claude / cursor / pi adaptation facts. */
export const HOSTS = {
  claude: {
    promptForm: "ref-prefixed",
    cli: "claude",
    invoke: "-p --output-format text --dangerously-skip-permissions",
    output: "text",
    ship: "full",
    detect: { env: "CLAUDE_CODE_SESSION_ID", aiAgentPrefix: "claude-code" },
    install: INSTALL_ROWS,
    cache: {
      mechanism: "explicit",
      minTokens: 512,
      readMultiplier: 0.1,
      writeMultiplier: 1.25,
      ttlMinutes: 5,
      observable: true,
    },
  },
  cursor: {
    promptForm: "ref-prefixed",
    cli: "cursor-agent",
    invoke: "--print --output-format text --force",
    output: "text",
    ship: "full",
    detect: { env: "CURSOR_TRACE_ID" },
    install: {
      kairos: "pending",
      superpowers: "pending",
      "mattpocock-skills": "pending",
      impeccable: "pending",
    },
    cache: { mechanism: "auto-prefix", minTokens: "pending", observable: false },
  },
  pi: {
    promptForm: "ref-prefixed",
    cli: "pi",
    invoke: "-p --mode text",
    output: "text",
    ship: "full",
    detect: { env: "AI_AGENT", value: "pi" },
    install: {
      kairos: ["pi install npm:@oscaner-skills/kairos"],
      superpowers: ["pi install git:github.com/obra/superpowers"],
      "mattpocock-skills": ["pi install git:github.com/mattpocock/skills"],
      impeccable: ["npx impeccable install --providers=pi --scope=global -y"],
    },
    cache: { mechanism: "auto-prefix", minTokens: "pending", observable: false },
  },
} as const satisfies Readonly<Record<HostId, HostRow>>;

/** The dispatch table — the phase/type → skill-ref resolution. The implement slot
 *  is the M1 supersede (P5): it names the upstream `mattpocock-skills:implement`
 *  skill — the tdd alias is retired from the dispatch. The REVIEW rows are the
 *  task/branch ref keys only (the spec/plan rows' URC review criteria migrated to
 *  the template plane's REVIEWS at the v1.8 closeout — their single typed home;
 *  the parallel-sub-agents note prose is deleted — P5 forbidden text). */
export const DISPATCH = {
  implement: "mattpocock-skills:implement",
  fix: "mattpocock-skills:tdd",
  review: {
    task: { ref: "mattpocock-skills:code-review" },
    branch: { ref: "mattpocock-skills:code-review" },
  },
} as const satisfies DispatchTable;

/** The reference table — every `<pkg>:<skill>` cross-skill reference key and its
 *  per-harness slash form: claude/cursor use `/namespace:skill`, pi the flat
 *  `/skill:<bare>` form. The `mattpocock-skills:implement` key is registered here
 *  (P5 — the implement dispatch's first-class refs-domain entry). */
export const REFS = {
  "superpowers:brainstorming": {
    claude: "/superpowers:brainstorming",
    cursor: "/superpowers:brainstorming",
    pi: "/skill:brainstorming",
  },
  "superpowers:writing-plans": {
    claude: "/superpowers:writing-plans",
    cursor: "/superpowers:writing-plans",
    pi: "/skill:writing-plans",
  },
  "superpowers:finishing-a-development-branch": {
    claude: "/superpowers:finishing-a-development-branch",
    cursor: "/superpowers:finishing-a-development-branch",
    pi: "/skill:finishing-a-development-branch",
  },
  "mattpocock-skills:implement": {
    claude: "/mattpocock-skills:implement",
    cursor: "/mattpocock-skills:implement",
    pi: "/skill:implement",
  },
  "mattpocock-skills:tdd": {
    claude: "/mattpocock-skills:tdd",
    cursor: "/mattpocock-skills:tdd",
    pi: "/skill:tdd",
  },
  "mattpocock-skills:code-review": {
    claude: "/mattpocock-skills:code-review",
    cursor: "/mattpocock-skills:code-review",
    pi: "/skill:code-review",
  },
  "mattpocock-skills:grilling": {
    claude: "/mattpocock-skills:grilling",
    cursor: "/mattpocock-skills:grilling",
    pi: "/skill:grilling",
  },
  "kairos:cdd-design": {
    claude: "/kairos:cdd-design",
    cursor: "/kairos:cdd-design",
    pi: "/skill:cdd-design",
  },
  "kairos:cdd-spec": {
    claude: "/kairos:cdd-spec",
    cursor: "/kairos:cdd-spec",
    pi: "/skill:cdd-spec",
  },
  "kairos:cdd-charter": {
    claude: "/kairos:cdd-charter",
    cursor: "/kairos:cdd-charter",
    pi: "/skill:cdd-charter",
  },
  "kairos:cdd-phase": {
    claude: "/kairos:cdd-phase",
    cursor: "/kairos:cdd-phase",
    pi: "/skill:cdd-phase",
  },
  "kairos:cdd-plan": {
    claude: "/kairos:cdd-plan",
    cursor: "/kairos:cdd-plan",
    pi: "/skill:cdd-plan",
  },
  "kairos:cdd-dev": { claude: "/kairos:cdd-dev", cursor: "/kairos:cdd-dev", pi: "/skill:cdd-dev" },
  "kairos:cdd-close": {
    claude: "/kairos:cdd-close",
    cursor: "/kairos:cdd-close",
    pi: "/skill:cdd-close",
  },
  "kairos:cdd-report": {
    claude: "/kairos:cdd-report",
    cursor: "/kairos:cdd-report",
    pi: "/skill:cdd-report",
  },
} as const satisfies HostReferenceTable;

/** The typed harness contract — one constant: hosts + dispatch + refs. */
export const HOST_CONTRACT = {
  hosts: HOSTS,
  dispatch: DISPATCH,
  refs: REFS,
} as const satisfies HostContract;
