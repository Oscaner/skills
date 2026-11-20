// packages/cdd-engine/src-next/session/carrier-rulings.ts
// P31 T2 — the orchestrator's RULINGS sidecar: the one supported landing point for a
// ruling on an engine-persisted carrier (design spec §2.1/§2.6). The engine's carrier
// bytes are frozen at persist time, so a ruling never edits them: it is its own file,
// rendered by the artifact matrix's `rulings` row from the REVIEWED round's identity
// (P36 §2.10), and read back through the strict schema below. The file is the
// orchestrator's; the judgment is the engine's — a sidecar the schema refuses is a hard
// stop BEFORE the fix child is spawned, so a written ruling can never be silently
// invisible to the round that consumes it.
//
// Two levels, both strict (unknown keys are refused, never ignored): the top level
// carries `carrier` (optional; when present it must name the carrier file) and
// `rulings` (required array); each ruling carries ONE identifier — `finding`, or its
// `id` alias, normalized to `finding` on the way in — plus `ruling` (both required
// strings) and the optional `at` / `by`. A ruling's identifier must name a finding of
// the carrier it answers — the id set is the caller's fact, injected.
//
// The sidecar PATH is not minted here: it is the artifact matrix's `rulings` row
// rendered from the reviewed round's identity and resolved by the caller's workspace
// (`render(identity, "rulings")`). Only the NAME is the matrix's; the `carrier` key's
// comparison still reads the carrier's own basename, so neither direction of the
// relationship is derived from the other side's string.
//
// The sidecar is NEVER sealed by the engine: only the engine's own carriers are.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ArtifactRegistry, type IdentifierVocabulary } from "./round-artifacts.ts";

/** One recorded ruling — the finding it answers and the ruling's own text, plus the
 *  two machine-readable cells (P41 §2.3): the verdict and, when the reviewer is
 *  overruled, the probe that shows why. */
export interface Ruling {
  /** The carrier finding id the ruling answers (`F1`, `F2` …). */
  readonly finding: string;
  /** The ruling verdict / reasoning, verbatim. */
  readonly ruling: string;
  /** The machine-readable verdict (P41 §2.3) — `fixed` or `rejected`. Absent on a
   *  legacy sidecar, which stays legal: no migration is owed. */
  readonly verdict?: Verdict;
  /** The reproduction a `rejected` verdict owes (P41 §2.3) — the finding's own
   *  `repro` counter-part: where a reader re-checks that the review was wrong. */
  readonly probe?: string;
  /** When the ruling was recorded (optional, the orchestrator's stamp). */
  readonly at?: string;
  /** Who recorded the ruling (optional). */
  readonly by?: string;
}

/** The verdict's closed set (P41 §2.3) — one word, never a synonymous third key. */
export type Verdict = "fixed" | "rejected";

/** The declared verdict values, in the order a refusal names them. */
const VERDICTS: readonly Verdict[] = ["fixed", "rejected"];

/** The sidecar's three-state read: no file / a schema-conforming file / a refusal. */
export type RulingVerdict =
  | { readonly kind: "absent" }
  | { readonly kind: "ok"; readonly rulings: readonly Ruling[] }
  | { readonly kind: "invalid"; readonly reason: string };

/** The top-level keys the schema declares — anything else is refused. */
const TOP_KEYS: ReadonlySet<string> = new Set(["carrier", "rulings"]);

/** The ruling schema's NON-identifier fields — the verdict text, the orchestrator's
 *  optional stamp and the two machine-readable cells (`verdict` / `probe`, P41 §2.3).
 *  The identifier field is deliberately absent from this list: its acceptance set is the
 *  artifact matrix's `rulings` row declaration alone (§2.8), so `finding` / `id` are
 *  never enumerated a second time here. */
const RULING_FIELDS: readonly string[] = ["ruling", "at", "by", "verdict", "probe"];

/** A parsed-but-not-yet-judged file: present facts only. */
type ParsedSidecar =
  | { readonly kind: "absent" }
  | { readonly kind: "ok"; readonly value: unknown }
  | { readonly kind: "invalid"; readonly reason: string };

/** CarrierRulings — the lenient read and the strict judgment of a rulings sidecar.
 *  Stateless: every call takes the sidecar's own path AND the carrier it answers (the
 *  strict schema's `carrier` key speaks the carrier's fact; the id set is the caller's).
 *  The path itself is the artifact matrix's render — this class never derives one. */
// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated sidecar read surface — the zero-bare-function discipline admits no standalone predicate functions.
export class CarrierRulings {
  /** The sidecar's rulings as recorded — null when the file is absent, unparsable, does
   *  not carry a rulings array, or carries a `carrier` key naming another file. The
   *  lenient side is the TOLERANCE of unknown keys / unknown finding ids; the carrier
   *  fact is judged here too, so neither consumer can read a sidecar that answers a
   *  different carrier. The dispatch gate judges through `verdict`; the read face that
   *  renders the ruling bodies takes this one. */
  static read(
    sidecarPath: string,
    carrierPath: string,
  ): { readonly rulings: readonly Ruling[] } | null {
    const parsed = CarrierRulings.#parse(sidecarPath);
    if (parsed.kind !== "ok") return null;
    const record = CarrierRulings.#recordOf(parsed.value);
    if (record === null) return null;
    if (CarrierRulings.#carrierRefusal(record, carrierPath) !== null) return null;
    return CarrierRulings.#lenientRulings(record);
  }

  /** The strict judgment — the fix dispatch's pre-spawn gate. `findingIds` is the
   *  carrier's own finding-id set: a ruling on a finding the carrier does not carry is
   *  refused, never carried into the round as a phantom. */
  static verdict(
    sidecarPath: string,
    carrierPath: string,
    findingIds: ReadonlySet<string>,
  ): RulingVerdict {
    const parsed = CarrierRulings.#parse(sidecarPath);
    if (parsed.kind !== "ok") return parsed;
    const record = CarrierRulings.#recordOf(parsed.value);
    if (record === null) {
      return CarrierRulings.#invalid(sidecarPath, "the sidecar is not a JSON object");
    }
    if (!CarrierRulings.#keysWithin(record, TOP_KEYS)) {
      return CarrierRulings.#invalid(
        sidecarPath,
        `unknown top-level key(s) — the schema declares ${[...TOP_KEYS].join(" / ")}`,
      );
    }
    const carrierRefusal = CarrierRulings.#carrierRefusal(record, carrierPath);
    if (carrierRefusal !== null) return CarrierRulings.#invalid(sidecarPath, carrierRefusal);
    if (!("rulings" in record)) {
      return CarrierRulings.#invalid(sidecarPath, "the sidecar carries no `rulings` array");
    }
    if (!Array.isArray(record.rulings)) {
      return CarrierRulings.#invalid(sidecarPath, "`rulings` is not an array");
    }
    const rulings: Ruling[] = [];
    const vocabulary = CarrierRulings.#identifier();
    for (const [index, entry] of record.rulings.entries()) {
      const ruling = CarrierRulings.#rulingOf(entry, index, findingIds, vocabulary);
      if (typeof ruling === "string") return CarrierRulings.#invalid(sidecarPath, ruling);
      rulings.push(ruling);
    }
    return { kind: "ok", rulings };
  }

  /** Parse the file at one path — absent vs unparsable are different facts. */
  static #parse(sidecar: string): ParsedSidecar {
    if (!existsSync(sidecar)) return { kind: "absent" };
    try {
      return { kind: "ok", value: JSON.parse(readFileSync(sidecar, "utf8")) as unknown };
    } catch {
      return { kind: "invalid", reason: `${sidecar}: the sidecar is not JSON` };
    }
  }

  /** One refusal — the path is named so the operator sees WHICH sidecar was refused. */
  static #invalid(sidecar: string, reason: string): RulingVerdict {
    return { kind: "invalid", reason: `${sidecar}: ${reason}` };
  }

  /** The value narrowed to a plain object (arrays and null are not records). */
  static #recordOf(value: unknown): Record<string, unknown> | null {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  /** Whether every own key of `record` is declared by `declared`. */
  static #keysWithin(record: Record<string, unknown>, declared: ReadonlySet<string>): boolean {
    return Object.keys(record).every((key) => declared.has(key));
  }

  /** The `carrier` key's refusal — absent is fine; present must name this carrier. */
  static #carrierRefusal(record: Record<string, unknown>, carrierPath: string): string | null {
    if (!("carrier" in record)) return null;
    const declared = record.carrier;
    const expected = path.basename(carrierPath);
    if (typeof declared !== "string" || declared !== expected) {
      return `\`carrier\` names ${JSON.stringify(declared)} ≠ the carrier ${expected}`;
    }
    return null;
  }

  /** One ruling entry — the narrowed record with its identifier NORMALIZED to the
   *  canonical spelling, or the refusal's reason string. The accepted spellings are the
   *  matrix row's declaration (`finding` · `id`), so a sidecar written either way is one
   *  ruling, and an unknown key is still a whole-file refusal. */
  static #rulingOf(
    entry: unknown,
    index: number,
    findingIds: ReadonlySet<string>,
    vocabulary: IdentifierVocabulary,
  ): Ruling | string {
    const record = CarrierRulings.#recordOf(entry);
    if (record === null) return `ruling #${index + 1} is not a JSON object`;
    const declared = new Set([...vocabulary.accepts, ...RULING_FIELDS]);
    const unknown = Object.keys(record).filter((key) => !declared.has(key));
    if (unknown.length > 0) {
      return `ruling #${index + 1} carries unknown key(s) — ${unknown.join(", ")}`;
    }
    const spelling = CarrierRulings.#identifierKeyOf(record, index, vocabulary);
    if (typeof spelling !== "string") return spelling.reason;
    const finding = record[spelling];
    const { ruling, at, by, verdict, probe } = record;
    if (typeof finding !== "string") {
      return `ruling #${index + 1} carries no string \`${vocabulary.canonical}\``;
    }
    if (typeof ruling !== "string") return `ruling #${index + 1} carries no string \`ruling\``;
    if (at !== undefined && typeof at !== "string") {
      return `ruling #${index + 1} carries a non-string \`at\``;
    }
    if (by !== undefined && typeof by !== "string") {
      return `ruling #${index + 1} carries a non-string \`by\``;
    }
    const verdictRefusal = CarrierRulings.#verdictRefusal(index, verdict, probe);
    if (verdictRefusal !== null) return verdictRefusal;
    if (!findingIds.has(finding)) {
      return `ruling #${index + 1} answers ${finding}, which is not a finding of the carrier`;
    }
    return {
      finding,
      ruling,
      ...(typeof verdict === "string" ? { verdict: verdict as Verdict } : {}),
      ...(typeof probe === "string" ? { probe } : {}),
      ...(at === undefined ? {} : { at }),
      ...(by === undefined ? {} : { by }),
    };
  }

  /** The `verdict` / `probe` pair's refusal (P41 §2.3) — null when it passes. The
   *  verdict is a closed set; a `rejected` verdict OWES its `probe` (rejecting is the
   *  one "the review was wrong" move, so it must carry a re-checkable path), while
   *  `fixed` needs none (the change itself is the evidence) and a sidecar with no
   *  verdict owes nothing (legacy free text stays legal). A probe WITHOUT a verdict is
   *  legal: `probe` is an optional cell, not a verdict-dependent one. */
  static #verdictRefusal(index: number, verdict: unknown, probe: unknown): string | null {
    if (verdict === undefined) {
      if (probe !== undefined && typeof probe !== "string") {
        return `ruling #${index + 1} carries a non-string \`probe\``;
      }
      return null;
    }
    if (typeof verdict !== "string" || !VERDICTS.includes(verdict as Verdict)) {
      return `ruling #${index + 1} carries a \`verdict\` outside ${VERDICTS.join(" | ")}`;
    }
    if (probe !== undefined && typeof probe !== "string") {
      return `ruling #${index + 1} carries a non-string \`probe\``;
    }
    if (verdict !== "rejected") return null;
    if (typeof probe !== "string" || probe.trim().length === 0) {
      return `ruling #${index + 1} is \`rejected\` but carries no \`probe\``;
    }
    return null;
  }

  /** The identifier key ONE ruling carries — exactly one of the accepted spellings
   *  (`finding` · `id`). None is a refusal naming the canonical spelling; two is an
   *  ambiguity the schema settles by refusing the file, never by picking a winner. */
  static #identifierKeyOf(
    record: Record<string, unknown>,
    index: number,
    vocabulary: IdentifierVocabulary,
  ): string | { readonly reason: string } {
    const present = vocabulary.accepts.filter((key) => key in record);
    if (present.length === 1) return present[0]!;
    if (present.length === 0) {
      return { reason: `ruling #${index + 1} carries no string \`${vocabulary.canonical}\`` };
    }
    return {
      reason: `ruling #${index + 1} carries both ${present.map((key) => `\`${key}\``).join(" and ")} — one identifier per ruling`,
    };
  }

  /** The `rulings` row's identifier vocabulary — the matrix's OWN declaration (§2.8).
   *  A matrix that lost the row refuses loudly here: a second hand-written acceptance
   *  set is exactly the double expression this consumes away. */
  static #identifier(): IdentifierVocabulary {
    const declared = ArtifactRegistry.identifierOf("rulings");
    if (declared === null) {
      throw new Error("the artifact matrix's `rulings` row declares no identifier vocabulary");
    }
    return declared;
  }

  /** The lenient rulings read — null unless every entry carries the two required
   *  strings (an unknown key is tolerated here; the strict gate owns that refusal). The
   *  identifier is read through the SAME acceptance set, so both faces accept `id` and
   *  both hand back the canonical `finding`. */
  static #lenientRulings(value: unknown): { readonly rulings: readonly Ruling[] } | null {
    const record = CarrierRulings.#recordOf(value);
    if (record === null || !Array.isArray(record.rulings)) return null;
    const vocabulary = CarrierRulings.#identifier();
    const rulings: Ruling[] = [];
    for (const entry of record.rulings) {
      const row = CarrierRulings.#recordOf(entry);
      if (row === null) return null;
      const spelling = CarrierRulings.#identifierKeyOf(row, rulings.length, vocabulary);
      if (typeof spelling !== "string") return null;
      const finding = row[spelling];
      const { ruling, at, by, verdict, probe } = row;
      if (typeof finding !== "string" || typeof ruling !== "string") return null;
      rulings.push({
        finding,
        ruling,
        ...(typeof verdict === "string" ? { verdict: verdict as Verdict } : {}),
        ...(typeof probe === "string" ? { probe } : {}),
        ...(typeof at === "string" ? { at } : {}),
        ...(typeof by === "string" ? { by } : {}),
      });
    }
    return { rulings };
  }
}
