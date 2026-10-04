// packages/cdd-engine/src/documents/registry.ts — the DocType registry + singleton (P1 T1; plan
// §T1 · design C3). The three-instance registration table serving the S2/S4 dispatch entries:
// `resolve(kind)` is the fail-fast lookup (an unknown or unregistered kind throws with the kind
// text — the same fail-fast shape as the T6 detect zero-hit rejection), and `all()` exposes the
// FIXED iteration order [overall, plan, spec] regardless of registration order — the deterministic
// face the SchemaFactory product derivation (T3) and the audit traversal (T6) iterate. Partial
// registration is tolerated at construction (a registry may hold a subset while the kinds are
// wired in), but a duplicate kind registration is a wiring error and throws at construction —
// registration integrity is a construction invariant. Export face: the class + the `docTypeRegistry`
// singleton const (Criterion ② — zero bare functions; the same module-level holder pattern as the
// word-table singleton / CddRuntime's templateCache).
import type { DocKind, DocType } from "./doctype.ts";

/** The fixed doc-kind iteration order — the registry's deterministic traversal order (overall →
 *  plan → spec; the S1 detection scan order and the factory/audit derivation order). */
const DOC_KIND_ORDER: readonly DocKind[] = ["overall", "plan", "spec"];

/** The doc-type registration table — resolve by kind (fail-fast) + fixed-order iteration. */
export class DocTypeRegistry {
  readonly #byKind: ReadonlyMap<DocKind, DocType>;
  readonly #ordered: readonly DocType[];

  constructor(types: readonly DocType[]) {
    const byKind = new Map<DocKind, DocType>();
    for (const type of types) {
      if (byKind.has(type.kind)) {
        throw new Error(`duplicate doc type registered for kind: ${type.kind}`);
      }
      byKind.set(type.kind, type);
    }
    this.#byKind = byKind;
    // Fixed iteration order: present kinds are exposed in DOC_KIND_ORDER, never registration order.
    this.#ordered = DOC_KIND_ORDER.flatMap((kind) => {
      const type = byKind.get(kind);
      return type ? [type] : [];
    });
  }

  /** The doc type serving a kind — throws on an unknown or unregistered kind (the message carries
   *  the kind text: the S2/S4 dispatch entry's fail-fast contract). */
  resolve(kind: DocKind): DocType {
    const type = this.#byKind.get(kind);
    if (!type) throw new Error(`no doc type registered for kind: ${kind}`);
    return type;
  }

  /** Every registered doc type in the fixed iteration order [overall, plan, spec]. */
  all(): readonly DocType[] {
    return this.#ordered;
  }
}

/** The engine-wide doc-type registry singleton (module-level const — the same holder pattern as
 *  the word-table singleton / templateCache; no infra resolution, so module-top construction is
 *  safe). P1: the three concrete doc types land in T2 and are registered here — the empty
 *  registration is the honest P1 state (the singleton is live once T2 wires the subclasses in). */
export const docTypeRegistry = new DocTypeRegistry([]);
