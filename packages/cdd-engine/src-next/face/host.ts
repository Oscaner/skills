// packages/cdd-engine/src-next/face/host.ts
// T21 — the harness-contract typed surface: the harness-contract JSON's data-plane
// home as one typed constant module. The new tree reads zero config files — the
// host-adaptation contract (host detection · dispatch · refs) lives here and is
// imported, never parsed:
//
//   · HOSTS     — the per-harness rows (cli / invoke / promptForm / output / ship /
//     detect / env). The host-marker closure is single-sourced HERE: the
//     detect rows are the only copy of the marker env keys (the channel audit derives
//     the env whitelist from them — never a second declaration). The promptForm
//     column (§3.5) is the prompt-position semantics data contract — how the
//     skill-ref enters the child prompt (ref-prefixed | plain).
//   · DISPATCH  — the dispatch table: the skill-ref each dispatch face resolves
//     to. M1 supersede (P5): the implement slot names the upstream
//     `mattpocock-skills:implement` skill; the fix face carries no skill ref (its
//     fix discipline lives as the FIX_SHELL typed instructions).
//   · REFS      — the per-harness slash reference forms (claude uses the
//     `/namespace:skill` form; pi the flat `/skill:<bare>` form — the pi flat
//     namespace has no namespace-qualification syntax).
//   · HostDetect — the module-level host judgment (the detection's single home):
//     the dispatch face's detectHost delegates here; the delivery face's Capsule wiring
//     reads the same judgment over process.env.
//
// P5 lands here: the forbidden parallel-sub-agents prose is deleted from the review
// dispatch rows (the task/branch rows carry their ref only) and the review
// criteria — the URC spec/plan axes + the writing-plans self-check + the
// verification-evidence duty — land in render/templates.ts (the axes guide's
// typed home). The `mattpocock-skills:implement` ref key is registered here.
//
// Module-level exports are types / the declared constant data — zero behavior-
// carrying bare functions (the plan's zero-bare-function discipline).

/** The harness ids the contract adapts — the runtime companion of `HostId` and the
 *  single source of the host vocabulary: `HostId` derives from it, the `HOSTS` key
 *  set closes over it, and the `--harness` value range plus the detect walk read it
 *  (the production face carries no second copy of the host literal list). */
export const HOST_IDS = ["claude", "pi"] as const;

/** The harness ids the contract adapts. */
export type HostId = (typeof HOST_IDS)[number];

/** One host-detect row — the marker env key (+ the AI_AGENT match semantics). */
export interface HostDetectSpec {
  /** The marker env key the host detection reads. */
  env: string;
  /** pi-only: the AI_AGENT exact value the detection matches (`=== "value"`). */
  value?: string;
  /** claude-only: the AI_AGENT prefix the detection matches via startsWith. */
  aiAgentPrefix?: string;
}

/** The prompt-position semantics of a harness — HOW the skill-ref enters the child
 *  prompt (the §3.5 data contract, resolved by #childPrompt — the from-code-assumed
 *  prompt assembly becomes a per-host row). `ref-prefixed`: the slash ref prefixes
 *  the single prompt positional; `plain`: the child receives the prompt verbatim
 *  (no ref to prefix — the URC-prose rows). */
export type PromptForm = "ref-prefixed" | "plain";

/** One harness's capability facts (T25 — the capabilities per-harness declaration):
 *  the tested dispatch faces, one data column per row, zero prose. */
export interface HostCapabilities {
  /** The parallel sub-agent dispatch face — `true` the measured face (claude),
   *  `"pending"` the declared-but-unproven face (pi — the per-tested stance: the
   *  face is declared yet no run has exercised it). */
  parallel: boolean | "pending";
}

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
  /** The capability facts — the tested dispatch-face columns (T25). */
  capabilities: HostCapabilities;
  /** The per-host child TTL pin — the dispatch env the engine layers over the
   *  inherited env (engine values win). */
  env: Readonly<Record<string, string>>;
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
  /** The review phase rows — the task/branch ref keys (the spec/plan rows carry no
   *  skill ref — the review criteria live in the template plane). */
  review: Readonly<Record<"wave" | "branch", ReviewDispatchRow>>;
}

/** The per-harness slash reference forms of one ref key. */
export type HostReferenceForm = Readonly<Record<HostId, string>>;

/** The full reference table — every `<pkg>:<skill>` cross-skill reference key. */
export type HostReferenceTable = Readonly<Record<string, HostReferenceForm>>;

/** The extended typed harness contract — hosts + dispatch + refs. */
export interface HostContract {
  hosts: Readonly<Record<HostId, HostRow>>;
  dispatch: DispatchTable;
  refs: HostReferenceTable;
}

/** The per-harness host rows — claude / pi adaptation facts. */
export const HOSTS = {
  claude: {
    promptForm: "ref-prefixed",
    cli: "claude",
    invoke:
      "-p --output-format text --dangerously-skip-permissions --exclude-dynamic-system-prompt-sections",
    output: "text",
    ship: "full",
    detect: { env: "CLAUDE_CODE_SESSION_ID", aiAgentPrefix: "claude-code" },
    capabilities: { parallel: true },
    env: { FORCE_PROMPT_CACHING_5M: "1" },
  },
  pi: {
    promptForm: "ref-prefixed",
    cli: "pi",
    invoke: "-p --mode text",
    output: "text",
    ship: "full",
    detect: { env: "AI_AGENT", value: "pi" },
    capabilities: { parallel: "pending" },
    env: { PI_CACHE_RETENTION: "short" },
  },
} as const satisfies Readonly<Record<HostId, HostRow>>;

/** The dispatch table — the phase/type → skill-ref resolution. The implement slot
 *  is the M1 supersede (P5): it names the upstream `mattpocock-skills:implement`
 *  skill. The fix face carries no skill ref (its fix discipline rides the FIX_SHELL
 *  typed instructions). The REVIEW rows are the task/branch ref keys only (the
 *  spec/plan rows' URC review criteria migrated to the template plane's REVIEWS at
 *  the v1.8 closeout — their single typed home; the parallel-sub-agents note prose
 *  is deleted — P5 forbidden text). */
export const DISPATCH = {
  implement: "mattpocock-skills:implement",
  review: {
    wave: { ref: "mattpocock-skills:code-review" },
    branch: { ref: "mattpocock-skills:code-review" },
  },
} as const satisfies DispatchTable;

/** The reference table — every `<pkg>:<skill>` cross-skill reference key and its
 *  per-harness slash form: claude uses `/namespace:skill`, pi the flat
 *  `/skill:<bare>` form. The `mattpocock-skills:implement` key is registered here
 *  (P5 — the implement dispatch's first-class refs-domain entry). */
export const REFS = {
  "superpowers:brainstorming": {
    claude: "/superpowers:brainstorming",
    pi: "/skill:brainstorming",
  },
  "superpowers:writing-plans": {
    claude: "/superpowers:writing-plans",
    pi: "/skill:writing-plans",
  },
  "superpowers:finishing-a-development-branch": {
    claude: "/superpowers:finishing-a-development-branch",
    pi: "/skill:finishing-a-development-branch",
  },
  "mattpocock-skills:implement": {
    claude: "/mattpocock-skills:implement",
    pi: "/skill:implement",
  },
  "mattpocock-skills:code-review": {
    claude: "/mattpocock-skills:code-review",
    pi: "/skill:code-review",
  },
  "mattpocock-skills:grilling": {
    claude: "/mattpocock-skills:grilling",
    pi: "/skill:grilling",
  },
  "kairos:cdd-design": {
    claude: "/kairos:cdd-design",
    pi: "/skill:cdd-design",
  },
  "kairos:cdd-spec-writer": {
    claude: "/kairos:cdd-spec-writer",
    pi: "/skill:cdd-spec-writer",
  },
  "kairos:cdd-plan": {
    claude: "/kairos:cdd-plan",
    pi: "/skill:cdd-plan",
  },
  "kairos:cdd-dev": { claude: "/kairos:cdd-dev", pi: "/skill:cdd-dev" },
  "kairos:cdd-close": {
    claude: "/kairos:cdd-close",
    pi: "/skill:cdd-close",
  },
  "kairos:cdd-report": {
    claude: "/kairos:cdd-report",
    pi: "/skill:cdd-report",
  },
} as const satisfies HostReferenceTable;

/** The typed harness contract — one constant: hosts + dispatch + refs (the single
 *  harness-adaptation truth; zero `_doc`/`$schema` prose). */
export const HOST_CONTRACT = {
  hosts: HOSTS,
  dispatch: DISPATCH,
  refs: REFS,
} as const satisfies HostContract;

/** HostDetect — the module-level host judgment (the detection's single home). The
 *  input is the inline structural env view — no cross-import (the host plane
 *  must stay import-clean toward the dispatch face). */
// biome-ignore lint/complexity/noStaticOnlyClass: the module-level host-detect surface — the zero-bare-function discipline admits no standalone predicate functions.
export class HostDetect {
  /** detect(env) — the first host detect row that matches, in the pinned `HOST_IDS`
   *  order `claude` → `pi` (specific markers first, the generic AI_AGENT
   *  last). One row detects by its primary marker (a session env, presence/enum —
   *  a UUID CLAUDE_CODE_SESSION_ID is claude by presence) or by the AI_AGENT
   *  prefix (AI_AGENT=claude-code-…); no match returns `""`. */
  static detect(env: Record<string, string | undefined>): HostId | "" {
    for (const id of HOST_IDS) {
      const detect: HostDetectSpec = HOSTS[id].detect;
      if (detect.env !== undefined && detect.env !== "") {
        const marker = env[detect.env];
        if (marker !== undefined && marker.length > 0) {
          if (detect.value !== undefined && marker !== detect.value) continue;
          return id;
        }
      }
      if (detect.aiAgentPrefix !== undefined && detect.aiAgentPrefix.length > 0) {
        const agent = env.AI_AGENT;
        if (agent !== undefined && agent.length > 0 && agent.startsWith(detect.aiAgentPrefix))
          return id;
      }
    }
    return "";
  }
}
