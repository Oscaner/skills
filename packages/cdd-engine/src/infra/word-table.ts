// packages/cdd-engine/src/infra/word-table.ts — the engine word-table typed view (C6): the CDD
// contract lexicon (config/contract-lexicon.json — the command + schema families) loaded once and
// schema-validated AT CONSTRUCTION against its shape authority (config/schema/contract-lexicon.json
// — additionalProperties: false, so an unknown key is a loud construction failure, never a silent
// drift). The engine capsule output points (exit.ts / root.ts / artifacts/handoff/finalize.ts /
// rules/result-face.ts) read their EMITTED wording through the accessors — the emitted vocabulary
// is data (a rename is a data change, not an engine edit), and the station map gives every
// emission site a semantic key instead of a literal. Constructor-time data failures (load /
// schema violation) throw a plain Error (a data-validity error, same class as JSON.parse); the
// accessor domain guards are library invariants (an unknown accessor family is a developer error).
//
// Ownership: the guards family (residue / escape / zero-debt / buildability / banned-shape words)
// lives in the repo guard lexicon (scripts/lib/guard-lexicon.json) and is NOT part of this view —
// the engine package carries zero guard words (the schema's root additionalProperties:false
// rejects a guards key here by construction).
import { readFileSync } from "node:fs";
import path from "node:path";
import { Ajv, type ValidateFunction } from "ajv";

import { invariant } from "./exit.ts";
import { resolveResource } from "./resource.ts";

export const CONTRACT_LEXICON_SCHEMA_NAME = "contract-lexicon";

/** The engine contract-word data shape (the command + schema families — the shape the schema file
 *  declares; the parsed JSON is narrowed to this contract at the load boundary). */
export interface CommandLexicon {
  _doc: string;
  command: {
    status: {
      vocab: string[];
      axes: { judgment: string[]; work: string[] };
    };
    capsule: { tokens: string[]; readbackWording: string };
    route: {
      routeTokens: string[];
      stations: { next: string; blocked: string; warn: string; cliMissing: string };
    };
  };
  schema: { anatomy: { schemaPath: string; skillsRoot: string } };
}

export type VocabDomain = "status" | "statusJudgment" | "statusWork";
export type TokenDomain = "capsule" | "route";
export type WordingDomain = "readback";
export type StationKind = "next" | "blocked" | "warn" | "cliMissing";
export type SchemaRef = "schema.anatomy.schemaPath" | "schema.anatomy.skillsRoot";

/** WordTable — the contract lexicon's typed view (Criterion ②; constructor injection — a test
 *  passes explicit paths to prove the schema-construction contract on fabricated data). The class
 *  is the single engine face over the lexicon: every accessor returns the loaded data (each array
 *  read returns the data's own array), and the constructor's schema validation is the shape gate
 *  that makes the lexicon genuinely load-bearing for the engine output surfaces. */
export class WordTable {
  readonly #lexicon: CommandLexicon;

  constructor(
    opts: {
      /** The lexicon JSON path. Default: the logical-name locator's contract-lexicon resource. */
      lexiconPath?: string;
      /** The shape-authority schema path. Default: the generic schema namespace's
       *  contract-lexicon.json. */
      schemaPath?: string;
      /** Optional resolver root for the logical-name lookups (tests against fabricated layouts). */
      fromDir?: string;
    } = {},
  ) {
    const schemaPath =
      opts.schemaPath ??
      path.join(resolveResource("schema", opts.fromDir), `${CONTRACT_LEXICON_SCHEMA_NAME}.json`);
    const lexiconPath = opts.lexiconPath ?? resolveResource("contract-lexicon", opts.fromDir);
    // JSON.parse boundary: the shipped word table. Constructor-time schema validation — the shape
    // authority with additionalProperties:false (an unknown key is a construction failure).
    const parsed = JSON.parse(readFileSync(lexiconPath, "utf8")) as object;
    this.#validateShape(parsed, schemaPath);
    this.#lexicon = parsed as unknown as CommandLexicon;
  }

  #validateShape(value: object, schemaPath: string): void {
    // JSON.parse boundary: the canonical shape-authority schema document.
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema) as ValidateFunction<CommandLexicon>;
    if (!validate(value)) {
      const detail = (validate.errors ?? [])
        .map((e) => `${e.instancePath || "$"} ${e.message ?? ""}`)
        .join("; ");
      throw new Error(`contract-lexicon schema violation: ${detail}`);
    }
  }

  /** The status vocabulary (the five handoff-conclusion values) / the dual-axis subsets. */
  vocab(domain: VocabDomain): string[] {
    switch (domain) {
      case "status":
        return this.#lexicon.command.status.vocab;
      case "statusJudgment":
        return this.#lexicon.command.status.axes.judgment;
      case "statusWork":
        return this.#lexicon.command.status.axes.work;
      default:
        invariant(false, `unknown word-table vocab domain: ${domain}`);
    }
  }

  /** The machine-token arrays of the command family — the capsule keys (status · blocker ·
   *  handoff) or the stdout route anchors. */
  tokens(domain: TokenDomain): string[] {
    switch (domain) {
      case "capsule":
        return this.#lexicon.command.capsule.tokens;
      case "route":
        return this.#lexicon.command.route.routeTokens;
      default:
        invariant(false, `unknown word-table token domain: ${domain}`);
    }
  }

  /** The wording strings of the command family. */
  wording(domain: WordingDomain): string {
    if (domain === "readback") return this.#lexicon.command.capsule.readbackWording;
    invariant(false, `unknown word-table wording domain: ${domain}`);
  }

  /** The addressed command-output tokens (the stderr station channels + the next-line prefix):
   *  the engine emission sites look their emitted wording up by semantic key, never a literal. */
  station(kind: StationKind): string {
    const stations = this.#lexicon.command.route.stations;
    if (kind === "next") return stations.next;
    if (kind === "blocked") return stations.blocked;
    if (kind === "warn") return stations.warn;
    if (kind === "cliMissing") return stations.cliMissing;
    invariant(false, `unknown word-table station kind: ${kind}`);
  }

  /** A schema-family reference (the skill-anatomy schema path / skills root the checkAnatomy
   *  surface reads). */
  ref(name: SchemaRef): string {
    if (name === "schema.anatomy.schemaPath") return this.#lexicon.schema.anatomy.schemaPath;
    if (name === "schema.anatomy.skillsRoot") return this.#lexicon.schema.anatomy.skillsRoot;
    invariant(false, `unknown word-table schema ref: ${name}`);
  }

  /** The loaded contract lexicon (assertion surfaces read the same data the accessors serve). */
  data(): CommandLexicon {
    return this.#lexicon;
  }
}

// The word-table singleton, lazily constructed (module const holder — same shape as the
// documents/schema.ts schema CACHE). Construction MUST be lazy, never module-top: the constructor
// resolves the contract-lexicon resource through the locator table, and resource.ts imports exit.ts
// which imports this module — an eager top-level construction would run the constructor against a
// mid-evaluation locator on the resource-first import order (TDZ), so the instance comes up on
// first use, after the module graph fully resolves.
const singleton: { wordTable: WordTable | null } = { wordTable: null };

/** The engine's word-table accessor (the capsule output points read their emitted wording from the
 *  single loaded + schema-validated instance). */
export function wordTable(): WordTable {
  if (singleton.wordTable === null) singleton.wordTable = new WordTable();
  return singleton.wordTable;
}
