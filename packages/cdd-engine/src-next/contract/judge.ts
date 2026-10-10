// packages/cdd-engine/src-next/contract/judge.ts
// T4 — the single interpreter's coordinator (design spec §2.1): the Contract
// class's validate() is the ONLY entry for structural judgment. It loads the
// parse context through the doc-type parsers (doc.ts — pure parse), composes the
// per-doc-key invariant strategy set (invariants.ts) as declared data, runs every
// strategy in order, and aggregates the findings. Judgment dispatch is a record
// index over the declared strategy set — zero switch-case, zero hand-written
// judgment branches in this module (the plan's coordinator semantics: the
// polymorphic strategy family judges, the coordinator assembles).

import { Words } from "../face/words.ts";
import { declaredRegistries } from "./declare.ts";
import type { ParsedDoc } from "./doc.ts";
import { docTypeParsers } from "./doc.ts";
import type { DocFs, Finding, Invariant, JudgeContext } from "./invariants.ts";
import {
  ContinuityInvariant,
  CrossDocChainInvariant,
  CrosslinkInvariant,
  DomainInvariant,
  FileExistenceInvariant,
  HollowInvariant,
  NodeFs,
  OrderInvariant,
  PresenceInvariant,
  ResidueInvariant,
  SectionScopedDomainInvariant,
  SelfBoundedInvariant,
  SiblingScanInvariant,
  UniquenessInvariant,
} from "./invariants.ts";
import type { DocKey } from "./project.ts";
import { Projector } from "./project.ts";
import { Translator } from "./translate.ts";

/** The three doc-type record keys — the policy-composition identity. */
const DOC_KEYS: readonly DocKey[] = ["overall", "plan", "phaseSpec"];

/** The judgment input — the doc's identity, content and the seam closures. */
export interface ContractInput {
  /** The doc-type record key of the document under judgment. */
  docKey: DocKey;
  /** The document's file path (message attribution + the doc's own dir). */
  path: string;
  /** The document's raw content. */
  content: string;
  /** The workspace/repo root the doc chain resolves against. */
  root: string;
  /** The dispatch phase id — enables the face-④ phase-registration check. */
  phaseId?: string;
  /** Pre-parsed chain/sibling docs (path → parsed record). */
  chainDocs?: ReadonlyMap<string, ParsedDoc>;
  /** The filesystem seam (defaults to node:fs). */
  fs?: DocFs;
}

/**
 * The contract coordinator — the interpreter's single face. One instance; the
 * strategy set is stateless (each strategy reads its judgment data from the
 * context), so construction is cheap and validates compose safely.
 *
 * The P7 structure-plane canonicalize seam (design spec §2.1): the Contract
 * self-holds a Translator, and validate() canonicalizes EVERY input line once at
 * the row source — the normalized view shared by parse and JudgeContext.lines.
 * Every valuePattern judgment face (presence occurrenceLines · domain
 * carrierLines · section-scoped · crosslink) matches the view, so the legacy
 * Chinese charter markers (the doc-arch decision-group / upstream-endorsements
 * leaves) match their English canonical element patterns through the recognition
 * face — never a second hand-written zh pattern. The view is never written back:
 * the source document stays byte-identical and the original lines remain in
 * input.content.
 */
export class Contract {
  /** The per-doc-key policy sets — the declared composition of the strategy family.
   *  All thirteen strategies are registry-driven and judge every doc type, so the
   *  per-key sets are the same ordered family; the record keying is what a future
   *  per-type ordering/selection change would carry. */
  readonly #strategies: Record<DocKey, readonly Invariant[]>;
  /** The projection carrier — the derived parse/skeleton faces the judgment reads. */
  readonly #projector: Projector;
  /** The row-source translator — the canonicalize seam carrier. One instance over
   *  the same locale word table the rest of the plane reads (the recognition face
   *  of the P7 translation layer); embedded like the projector, so the production
   *  construction points (`new Contract()`) stay argument-free. */
  readonly #translator: Translator;

  constructor() {
    this.#strategies = Contract.#buildPolicy();
    this.#projector = new Projector(declaredRegistries);
    this.#translator = new Translator(new Words());
  }

  /** validate(doc) — parse, compose, run, aggregate. The single judgment entry.
   *  Every input line canonicalizes ONCE at the row source (the normalized view);
   *  parse and the judgment context read the same view, the source stays intact. */
  validate(input: ContractInput): Finding[] {
    const lines = input.content.split("\n").map((line) => this.#translator.canonicalize(line));
    const parsed = docTypeParsers[input.docKey].parse(lines);
    const context: JudgeContext = {
      docKey: input.docKey,
      parsed,
      lines,
      path: input.path,
      root: input.root,
      slices: this.#projector.slices()[input.docKey],
      shape: this.#projector.shape()[input.docKey],
      registries: declaredRegistries,
      phaseId: input.phaseId,
      chainDocs: input.chainDocs,
      fs: input.fs ?? new NodeFs(),
    };
    const findings: Finding[] = [];
    for (const strategy of this.#strategies[input.docKey]) {
      findings.push(...strategy.evaluate(context));
    }
    return findings;
  }

  /** The declared strategy composition — one ordered family set per doc key. */
  static #buildPolicy(): Record<DocKey, readonly Invariant[]> {
    const family: readonly Invariant[] = [
      new PresenceInvariant(),
      new UniquenessInvariant(),
      new DomainInvariant(),
      new CrosslinkInvariant(),
      new OrderInvariant(),
      new ContinuityInvariant(),
      new ResidueInvariant(),
      new HollowInvariant(),
      new SelfBoundedInvariant(),
      new FileExistenceInvariant(),
      new SiblingScanInvariant(),
      new CrossDocChainInvariant(),
      new SectionScopedDomainInvariant(),
    ];
    const policy = {} as Record<DocKey, readonly Invariant[]>;
    for (const key of DOC_KEYS) {
      policy[key] = family;
    }
    return policy;
  }
}
