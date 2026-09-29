// packages/cdd-engine/src/infra/harness.ts — the harness OOP abstraction (P3 T1, Criterion ②).
// Each supported harness (claude / cursor / pi) is a class: a typed id, a typed row contract
// (cli/invoke/output/ship/cache/prefix/suffix held on the instance — never bare JSON reads), and
// an abstract detect(env) predicate. ORDER is the registration order = detection priority
// (SPECIFIC first, GENERIC last) — the legacy if-chain semantics (CURSOR_TRACE_ID →
// CLAUDE_CODE_SESSION_ID → AI_AGENT=claude-code*) preserved as data. Single-direction
// dependency: harness.ts consumes the Registry data facade (read row → typed access);
// infra/registry.ts never imports this module.
import { REG_PATH, Registry } from "./registry.ts";

export type HarnessId = "claude" | "cursor" | "pi";

/** The registry row contract each harness exposes as typed line access (self-held shape; the
 *  row a dispatch reads lives on the instance, not as bare registry reads at call sites). */
export interface HarnessRow {
  cli: string;
  invoke?: string;
  output?: string;
  ship?: string;
  cache?: unknown;
  prefix?: unknown;
  suffix?: unknown;
}

export abstract class Harness {
  abstract readonly id: HarnessId;

  /** Host-marker predicate: does this ambient env belong to this harness? */
  abstract detect(env: NodeJS.ProcessEnv): boolean;

  #row: HarnessRow | undefined;

  /** Lazy row read through the Registry data facade (untouched by detect — the hot path). */
  protected row(): HarnessRow {
    if (!this.#row) {
      this.#row = (new Registry().load(REG_PATH)[this.id] as HarnessRow | undefined) ?? {};
    }
    return this.#row;
  }

  get cli(): string {
    return this.row().cli ?? "";
  }

  get invoke(): string {
    return this.row().invoke ?? "";
  }

  get output(): string {
    return this.row().output ?? "";
  }

  get ship(): string {
    return this.row().ship ?? "";
  }

  get cache(): unknown {
    return this.row().cache;
  }

  get prefix(): unknown {
    return this.row().prefix;
  }

  get suffix(): unknown {
    return this.row().suffix;
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
