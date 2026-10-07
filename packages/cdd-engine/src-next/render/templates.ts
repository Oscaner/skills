// packages/cdd-engine/src-next/render/templates.ts
// T12 — TemplateAssembler: the template plane's single assembler over the
// template-contract.json data plane (read as steady data through the config
// loader). The dispatch prompt is assembled from the contract's declared zones in
// the contract's declared segment order (shell → return → round-context):
//   · the shell is the fixed shared frame (zero injection slots of its own — every
//     `{{TOKEN}}` it references belongs to a declared zone);
//   · the return zone is the per-return-format `## Return` block (the declared
//     formats — RETURN_STDOUT_BLOCK / RETURN_JSON / DOCS_FIX);
//   · the round-context zone is the only dynamic zone (the per-dispatch values).
// The hard gates: the return format must be declared, every token declared by the
// contract must be supplied with a non-empty value, every supplied value must be a
// declared token, and the assembled text must carry zero unresolved slots.

import type { TemplateContract } from "../infra/config.ts";
import { ConfigLoader } from "../infra/config.ts";

/** The per-dispatch slot values — one entry per declared template token. */
export interface TemplateValues {
  readonly [name: string]: string;
}

/**
 * The template assembler — one renderer over the template-contract data plane.
 * Construction reads the contract once (the config loader's single read point).
 */
export class TemplateAssembler {
  readonly #contract: TemplateContract;

  constructor(loader = new ConfigLoader()) {
    this.#contract = loader.templateContract();
  }

  /** The return formats the contract declares. */
  returnFormats(): readonly string[] {
    return Object.keys(this.#contract.sections.return);
  }

  /** The tokens the contract declares (all zones). */
  declaredTokens(): readonly string[] {
    return this.#contract.tokens.map((token) => token.name);
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
