// packages/cdd-engine/src-next/infra/config.ts
// T12 — the config plane: the external contract JSONs (engine-config /
// harness-contract / template-contract) are read as steady data through the
// logical-name locator (resource.ts). ConfigLoader is the plane's single loader —
// every consumer reads through one instance, never a second readFileSync.

import { readFileSync } from "node:fs";
import type { ResourceName } from "./resource.ts";
import { ResourceResolver } from "./resource.ts";

/** The handoff-namespace section of engine-config — the workspace segment + rules. */
export interface HandoffNamespace {
  workspaceRoot: string;
  slugRule: string;
  families: Record<string, unknown>;
}

/** The engine-config surface the new tree consumes. */
export interface EngineConfig {
  $version: number;
  contextContract?: {
    channels?: Record<string, { flag?: string; type?: string; values?: readonly string[] }>;
  };
  failureCategories?: { categories?: readonly unknown[] };
  handoffNamespace: HandoffNamespace;
}

/** The harness-contract surface (the host-harness adaptation table). */
export interface HarnessContract {
  _doc?: string;
  [harnessId: string]: unknown;
}

/** The template-contract surface — the single-file rendering data plane. */
export interface TemplateContract {
  $version: number;
  skeleton: {
    sections: readonly string[];
    segments: Record<string, readonly string[]>;
    order: readonly string[];
  };
  sections: {
    shell: readonly string[];
    return: Record<string, readonly string[]>;
    "round-context": readonly string[];
  };
  tokens: readonly { name: string; zone: string }[];
  clauses: Record<string, string>;
}

/**
 * The config read single point. Construction resolves the package root through the
 * injected locator (the default resolves the living tree); the accessors share one
 * parsed object per section — no second read point across instances.
 */
export class ConfigLoader {
  readonly #resolver: ResourceResolver;

  constructor(resolver = new ResourceResolver()) {
    this.#resolver = resolver;
  }

  /** The engine-config section accessors — the runtime-config consumed by the engine. */
  engineConfig(): EngineConfig {
    return this.#readJson("engine-config") as EngineConfig;
  }

  /** The harness-contract — the host-adaptation steady data. */
  harnessContract(): HarnessContract {
    return this.#readJson("harness-contract") as HarnessContract;
  }

  /** The template-contract — the rendering data plane (the template assembler reads here). */
  templateContract(): TemplateContract {
    return this.#readJson("template-contract") as TemplateContract;
  }

  /** The handoff-namespace section — the workspace-root single source. */
  handoffNamespace(): HandoffNamespace {
    return this.engineConfig().handoffNamespace;
  }

  #readJson(name: ResourceName): unknown {
    const file = this.#resolver.resolve(name);
    return JSON.parse(readFileSync(file, "utf8"));
  }
}
