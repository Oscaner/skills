// packages/cdd-engine/src/infra/harness.ts — the harness OOP abstraction (P3 T1, Criterion ②).
// Each supported harness (claude / cursor / pi) is a class: a typed id, a typed row contract
// (cli/invoke/output/ship/cache/install/detect held on the instance — never bare JSON reads), and
// an abstract detect(env) predicate. ORDER is the registration order = detection priority
// (SPECIFIC first, GENERIC last) — the legacy if-chain semantics (CURSOR_TRACE_ID →
// CLAUDE_CODE_SESSION_ID → AI_AGENT=claude-code*) preserved as data. Single-direction
// dependency: harness.ts consumes the Registry data facade (read row → typed access);
// infra/registry.ts never imports this module. C8: the dispatch prefix injection is no longer row
// data — it is DERIVED from the harness contract's dispatch + refs tables (registry.ts
// checkHarness stamps the derived prefix map on the entry); this class's typed access stays on
// the row's own fields (the derived injection lives on the checkHarness entry, not the row).
import { REG_PATH, Registry } from "./registry.ts";

export type HarnessId = "claude" | "cursor" | "pi";

/** The row contract each harness exposes as typed line access (self-held shape; the
 *  row a dispatch reads lives on the instance, not as bare registry reads at call sites). */
export interface HarnessRow {
  cli: string;
  invoke?: string;
  output?: string;
  ship?: string;
  cache?: CacheProfile;
  detect?: LexiconMarkerLike;
  install?: Record<string, string[]>;
}

export interface CacheProfile {
  mechanism: "explicit" | "auto-prefix" | "implicit";
  minTokens: number | "pending";
  readMultiplier?: number;
  writeMultiplier?: number;
  ttlMinutes?: number;
  observable?: boolean;
}

/** The detect-row shape (harness-contract detect — the host-marker data the predicate mirrors). */
export interface LexiconMarkerLike {
  env: string;
  aiAgentPrefix?: string;
  value?: string;
}

export abstract class Harness {
  abstract readonly id: HarnessId;

  /** Host-marker predicate: does this ambient env belong to this harness? */
  abstract detect(env: NodeJS.ProcessEnv): boolean;

  #row: HarnessRow | undefined;

  /** Lazy row read through the Registry data facade (untouched by detect — the hot path). The
   *  undefined-coalesce TRUE form: an absent registry row stays `undefined`; every getter handles
   *  the absence at its own call site (`?.` + default — no `{}` fallback object anywhere). */
  protected row(): HarnessRow | undefined {
    if (!this.#row) {
      this.#row = new Registry().load(REG_PATH)[this.id] as HarnessRow | undefined;
    }
    return this.#row;
  }

  get cli(): string {
    return this.row()?.cli ?? "";
  }

  get invoke(): string {
    return this.row()?.invoke ?? "";
  }

  get output(): string {
    return this.row()?.output ?? "";
  }

  get ship(): string {
    return this.row()?.ship ?? "";
  }

  get cache(): CacheProfile | undefined {
    return this.row()?.cache;
  }

  /** Typed row access for the detect marker (the right side of the `detect` disambiguation — the
   *  abstract predicate owns the `detect(env)` name). */
  get hostMarker(): LexiconMarkerLike | undefined {
    return this.row()?.detect;
  }

  get install(): Record<string, string[]> | undefined {
    return this.row()?.install;
  }
}

/** Cursor — SPECIFIC host marker (CURSOR_TRACE_ID), highest detection priority. */
export class CursorHarness extends Harness {
  readonly id = "cursor" as const;

  detect(env: NodeJS.ProcessEnv): boolean {
    return Boolean(env.CURSOR_TRACE_ID);
  }
}

/** Claude — CLAUDE_CODE_SESSION_ID or AI_AGENT=claude-code* (SPECIFIC markers). */
export class ClaudeHarness extends Harness {
  readonly id = "claude" as const;

  detect(env: NodeJS.ProcessEnv): boolean {
    return Boolean(env.CLAUDE_CODE_SESSION_ID) || (env.AI_AGENT ?? "").startsWith("claude-code");
  }
}

/** Pi — GENERIC host marker (AI_AGENT=pi; PI_CODING_AGENT=true corroborates the pi session),
 *  last detection priority. */
export class PiHarness extends Harness {
  readonly id = "pi" as const;

  detect(env: NodeJS.ProcessEnv): boolean {
    return env.AI_AGENT === "pi";
  }
}

/** Registration order = detection priority: SPECIFIC (Cursor) first, GENERIC (Pi) last — the
 *  legacy if-chain equivalence as data (CURSOR_TRACE_ID → CLAUDE_CODE_SESSION_ID -->
 *  AI_AGENT=claude-code* → AI_AGENT=pi → empty). */
export const ORDER: readonly Harness[] = [
  new CursorHarness(),
  new ClaudeHarness(),
  new PiHarness(),
];
