// packages/cdd-engine/src/env/process/host.ts
// The harness contract: how one dispatch host is spelled, invoked and detected.
//
// Four data faces and one probe:
//   · `HOST_IDS` — the host vocabulary, and the ONE source of it: `HostId` derives from
//     the tuple, the `HOSTS` key set closes over it, and the `--harness` value range
//     reads it. A second copy of the literal list anywhere is a drift.
//   · `HOSTS` — one row per harness (cli · invoke · prompt form · output · ship ·
//     the detect marker · capability columns · the dispatch env). The detect rows are
//     the ONLY copy of the host-marker environment keys: a channel-closure guard
//     derives its whitelist from them, never from a second table.
//   · `DISPATCH` — the skill-ref each dispatch face resolves to.
//   · `REFS` — the per-harness slash form of every cross-skill reference key. Both
//     forms are DERIVABLE from the key (`<namespace>:<skill>` → `/namespace:skill` on
//     claude, `/skill:<skill>` on pi), so the table is built from the key list instead
//     of being re-typed row by row: one source, two harness columns.
//
// `detectHost` is the probe itself — a pure reading of one env view. The process
// segment calls it at most ONCE per `Env`; nothing else may read the markers, because
// a second detection site is a second answer to "which harness is this?".
//
// Module-level exports are types and the declared constant data — zero
// behaviour-carrying bare functions (`detectHost` is a pure data reading).

/** The harness ids the contract adapts — the runtime companion of `HostId` and the
 *  single source of the host vocabulary. */
export const HOST_IDS = ["claude", "pi"] as const;

/** One harness id. */
export type HostId = (typeof HOST_IDS)[number];

/** One host-detect row — the marker env key and the value shape it matches. */
export interface HostDetectSpec {
  /** The marker environment key the detection reads. */
  env: string;
  /** The exact value the marker must carry (a presence-only marker omits it). */
  value?: string;
  /** The `AI_AGENT` prefix the detection accepts (`startsWith`). */
  aiAgentPrefix?: string;
}

/** How the skill-ref enters the child prompt: `ref-prefixed` prefixes the single prompt
 *  positional with the slash ref, `plain` hands the prompt over verbatim. */
export type PromptForm = "ref-prefixed" | "plain";

/** The capability columns of one harness — the tested dispatch faces, one data column
 *  per row: `true` the measured face, `"pending"` the declared-but-unproven face. */
export interface HostCapabilities {
  /** The parallel sub-agent dispatch face. */
  parallel: boolean | "pending";
}

/** One harness's adaptation facts. */
export interface HostRow {
  /** The harness CLI binary. */
  cli: string;
  /** The invoke flags prepended to the dispatch prompt. */
  invoke: string;
  /** How the skill-ref enters the child prompt. */
  promptForm: PromptForm;
  /** The harness output mode. */
  output: string;
  /** The ship status of the harness face. */
  ship: string;
  /** The detect row — the marker env key (+ its match semantics). */
  detect: HostDetectSpec;
  /** The capability facts. */
  capabilities: HostCapabilities;
  /** The per-host dispatch env the engine layers over the inherited one. */
  env: Readonly<Record<string, string>>;
}

/** One review dispatch slot — the ref key the review phase resolves to. */
export interface ReviewDispatchRow {
  /** The reference key. */
  ref: string;
}

/** The dispatch table — the phase/type → skill-ref resolution. */
export interface DispatchTable {
  /** The implement phase's reference key. */
  implement: string;
  /** The review phase rows — the task/branch reference keys. */
  review: Readonly<Record<"wave" | "branch", ReviewDispatchRow>>;
}

/** The per-harness slash forms of one reference key. */
export type HostReferenceForm = Readonly<Record<HostId, string>>;

/** Every reference key's per-harness slash form. */
export type HostReferenceTable = Readonly<Record<string, HostReferenceForm>>;

/** The harness contract — hosts + dispatch + refs (one typed constant, zero prose). */
export interface HostContract {
  hosts: Readonly<Record<HostId, HostRow>>;
  dispatch: DispatchTable;
  refs: HostReferenceTable;
}

/** The per-harness rows — the claude / pi adaptation facts. */
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

/** The dispatch table — the phase/type → skill-ref resolution. The fix face carries no
 *  skill ref (its discipline rides the fix prompt's typed instructions); a spec/plan
 *  review resolves no skill ref either (the review criteria ride the prompt's criteria
 *  body). */
export const DISPATCH = {
  implement: "mattpocock-skills:implement",
  review: {
    wave: { ref: "mattpocock-skills:code-review" },
    branch: { ref: "mattpocock-skills:code-review" },
  },
} as const satisfies DispatchTable;

/** Every cross-skill reference key the engine dispatches to or names in a prompt. */
export const REF_KEYS = [
  "superpowers:brainstorming",
  "superpowers:writing-plans",
  "superpowers:finishing-a-development-branch",
  "mattpocock-skills:implement",
  "mattpocock-skills:code-review",
  "mattpocock-skills:grilling",
  "kairos:cdd-design",
  "kairos:cdd-spec-writer",
  "kairos:cdd-plan",
  "kairos:cdd-dev",
  "kairos:cdd-close",
  "kairos:cdd-report",
] as const;

/** One reference key. */
export type RefKey = (typeof REF_KEYS)[number];

/** The per-harness slash form of one reference key — the two harness dialects of the
 *  SAME key: claude keeps the namespace (`/namespace:skill`), pi addresses the bare
 *  skill name (`/skill:skill`, its flat namespace has no qualification syntax). */
export const refFormOf = (key: string): HostReferenceForm => {
  const skill = key.slice(key.indexOf(":") + 1);
  return { claude: `/${key}`, pi: `/skill:${skill}` };
};

/** The reference table — one row per key, both harness columns derived. */
export const REFS: HostReferenceTable = Object.fromEntries(
  REF_KEYS.map((key) => [key, refFormOf(key)]),
);

/** The harness contract — one constant: hosts + dispatch + refs. */
export const HOST_CONTRACT = {
  hosts: HOSTS,
  dispatch: DISPATCH,
  refs: REFS,
} as const satisfies HostContract;

/** The host probe's input — one environment view. */
export type HostEnv = Readonly<Record<string, string | undefined>>;

/** The host probe — the input shape a `Process` segment is constructed with, so a pin
 *  can count the probes a facade makes without a real harness around it. */
export type HostProbe = (env: HostEnv) => HostId | "";

/** The one host detection: the first detect row that matches, in the pinned `HOST_IDS`
 *  order (the specific markers first, the generic `AI_AGENT` last). One row detects by
 *  its primary marker (presence, or an exact value) or by its `AI_AGENT` prefix; no
 *  match answers `""`. */
export const detectHost: HostProbe = (env) => {
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
      if (agent !== undefined && agent.length > 0 && agent.startsWith(detect.aiAgentPrefix)) {
        return id;
      }
    }
  }
  return "";
};
