// packages/cdd-engine/src/documents/factory.ts — the doc-structure SchemaFactory (P1 T3; plan §T3).
// The schema products (config/schema/{phase-spec,plan,overall}.json) become DERIVED products from
// the moment the shape domain lands: the factory iterates the doc-type registry in its fixed order
// and projects each type's shape domain onto its product file — a byte-faithful deterministic
// projection (`JSON.stringify(shape, null, 2) + "\n"` — key order + 2-space indent + trailing
// newline), landed in place (paths zero-migration, the source-home config/schema dir). The product
// set is exactly the three ACTIVE doc types the registry serves: add-phase-protocol / skill-anatomy
// are not doc types (Q6 closure — the factory never produces them, the schema.test five-name gate
// keeps guarding their hand-written files). Content edits go through DocType.shape, never the derived
// file — a manual edit is overwritten by the next writeAll. The factory is the Q1 "pin-first" face: the
// diff-pin tests (factory.test.ts) byte-pin each product against the file, determinism-pin the same
// projection, and close over the three active kinds. Export face: the class + the module singleton
// (Criterion ② — class + constructor injection, no bare functions).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveResourceSrc } from "../infra/resource.ts";
import type { DocKind } from "./doctype.ts";
import type { DocTypeRegistry } from "./registry.ts";
import { docTypeRegistry } from "./registry.ts";

/** Doc kind → schema product file base name (the `config/schema/<file>.json` each kind's shape
 *  projects onto). The only divergent pair: the phase-spec kind `"spec"` lands on
 *  `phase-spec.json` (DOC_SCHEMA_NAMES' file identity). */
const DOC_KIND_SCHEMA_FILE: Readonly<Record<DocKind, string>> = {
  overall: "overall",
  plan: "plan",
  spec: "phase-spec",
};

/** The doc-structure SchemaFactory — projects every registered doc type's shape domain onto its
 *  derived `config/schema/<kind>.json` product, byte-faithfully and deterministically. */
export class SchemaFactory {
  readonly #registry: DocTypeRegistry;

  /** The registry drives both the product set (every registered type produces exactly one product)
   *  and the iteration (the registry's fixed [overall, plan, spec] order — the deterministic
   *  projection order). */
  constructor(registry: DocTypeRegistry) {
    this.#registry = registry;
  }

  /** One kind's schema product bytes — the canonical projection of the type's shape domain
   *  (`JSON.stringify(shape, null, 2)` + the trailing newline: key order follows the shape's
   *  authored order, indentation is the fixed 2-space form, the file ends on exactly one newline).
   *  An unknown / unregistered kind fails fast through the registry's resolve throw. */
  render(kind: DocKind): string {
    const type = this.#registry.resolve(kind);
    return `${JSON.stringify(type.shape, null, 2)}\n`;
  }

  /** Every registered doc type's product, keyed by product file base name — the factory's product
   *  set (= the three active doc types; add-phase-protocol / skill-anatomy never appear — Q6). */
  renderAll(): Readonly<Record<string, string>> {
    const products: Record<string, string> = {};
    for (const type of this.#registry.all()) {
      products[DOC_KIND_SCHEMA_FILE[type.kind]] = this.render(type.kind);
    }
    return products;
  }

  /** Land the rendered products onto the schema dir in place (zero path migration — the default
   *  target is the source-home config/schema face the guards read; tests inject a temp dir). Only
   *  the three active products are written; every other schema file (add-phase-protocol /
   *  skill-anatomy / handoff schemas) is left untouched. Returns the written file base names. */
  writeAll(schemaDir = resolveResourceSrc("schema")): readonly string[] {
    mkdirSync(schemaDir, { recursive: true });
    const products = this.renderAll();
    for (const [file, bytes] of Object.entries(products)) {
      writeFileSync(path.join(schemaDir, `${file}.json`), bytes);
    }
    return Object.keys(products);
  }
}

/** The engine-wide schema-factory singleton (same holder pattern as docTypeRegistry — composition
 *  over the live registry, constructed after registration; the factory's default writeAll target is
 *  the source-home config/schema face, the canonical derivation location). */
export const schemaFactory = new SchemaFactory(docTypeRegistry);
