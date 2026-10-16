// packages/cdd-engine/src-next/infra/config.ts
// T21 — the config plane becomes a typed accessor facade: the external contract
// JSONs are gone (the new tree reads zero config files), and every stable fact
// lives in its single typed home — infra/runtime.ts (engine-config) · face/host.ts
// (harness contract) · render/templates.ts (template contract). ConfigLoader is the
// facade over those homes: the consumer surface (engineConfig · harnessContract ·
// templateContract · handoffNamespace) is unchanged, one no-I/O accessor per face.
//
// The previous JSON-plane interfaces (EngineConfig / HarnessContract /
// TemplateContract / HandoffNamespace) retire here — the typed data modules own the
// shapes; this module only routes.

import { HOST_CONTRACT, type HostContract } from "../face/host.ts";
import { TEMPLATE_PROMPT, type TemplatePrompt } from "../render/templates.ts";
import { ENGINE_RUNTIME, type EngineRuntime, type HandoffNamespace } from "./runtime.ts";

/**
 * The typed config accessor — the single façade over the typed data planes (zero
 * file reads: every accessor returns the declared constant of its single home).
 * Construction is trivial; the consumer surface matches the retired loader.
 */
export class ConfigLoader {
  /** The engine-config face — the typed engine runtime (version + channels + names). */
  engineConfig(): EngineRuntime {
    return ENGINE_RUNTIME;
  }

  /** The harness-contract face — the typed host adaptation contract (hosts + dispatch + refs). */
  harnessContract(): HostContract {
    return HOST_CONTRACT;
  }

  /** The template-contract face — the typed dispatch-prompt + review criteria. */
  templateContract(): TemplatePrompt {
    return TEMPLATE_PROMPT;
  }

  /** The handoff-namespace section — the workspace-root + the family naming single source. */
  handoffNamespace(): HandoffNamespace {
    return ENGINE_RUNTIME.handoffNamespace;
  }
}
