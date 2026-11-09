// packages/cdd-engine/src-next/session/carrier-rulings.ts
// P31 T2 — the orchestrator's RULINGS sidecar: the one supported landing point for a
// ruling on an engine-persisted carrier (design spec §2.1/§2.6). The engine's carrier
// bytes are frozen at persist time, so a ruling never edits them: it is written beside
// the carrier at the same stem, `<carrier>.json` → `<carrier>.rulings.json`, and read
// back through the strict schema below. The file is the orchestrator's; the judgment
// is the engine's — a sidecar the schema refuses is a hard stop BEFORE the fix child is
// spawned, so a written ruling can never be silently invisible to the round that
// consumes it.
//
// Two levels, both strict (unknown keys are refused, never ignored): the top level
// carries `carrier` (optional; when present it must name the carrier file) and
// `rulings` (required array); each ruling carries `finding` + `ruling` (both required
// strings) and the optional `at` / `by`. A ruling's `finding` must name a finding of
// the carrier it sits beside — the id set is the caller's fact, injected.
//
// The sidecar is NEVER sealed by the engine: only the engine's own carriers are.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** One recorded ruling — the finding it answers and the ruling's own text. */
export interface Ruling {
  /** The carrier finding id the ruling answers (`F1`, `F2` …). */
  readonly finding: string;
  /** The ruling verdict / reasoning, verbatim. */
  readonly ruling: string;
  /** When the ruling was recorded (optional, the orchestrator's stamp). */
  readonly at?: string;
  /** Who recorded the ruling (optional). */
  readonly by?: string;
}

/** The sidecar's three-state read: no file / a schema-conforming file / a refusal. */
export type RulingVerdict =
  | { readonly kind: "absent" }
  | { readonly kind: "ok"; readonly rulings: readonly Ruling[] }
  | { readonly kind: "invalid"; readonly reason: string };

/** The top-level keys the schema declares — anything else is refused. */
const TOP_KEYS: ReadonlySet<string> = new Set(["carrier", "rulings"]);

/** The keys one ruling declares — anything else is refused. */
const RULING_KEYS: ReadonlySet<string> = new Set(["finding", "ruling", "at", "by"]);

/** A parsed-but-not-yet-judged file: present facts only. */
type ParsedSidecar =
  | { readonly kind: "absent" }
  | { readonly kind: "ok"; readonly value: unknown }
  | { readonly kind: "invalid"; readonly reason: string };

/** CarrierRulings — the sidecar path rule, the lenient read and the strict judgment.
 *  Stateless: every call takes the carrier path (and, for the judgment, the carrier's
 *  own finding-id set), so the class holds no per-round state. */
// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated sidecar read surface — the zero-bare-function discipline admits no standalone predicate functions.
export class CarrierRulings {
  /** The sidecar path of a carrier — its trailing `.json` replaced by `.rulings.json`
   *  (a path that does not end in `.json` gains the suffix as-is, never a guess). */
  static pathFor(carrierPath: string): string {
    return carrierPath.endsWith(".json")
      ? `${carrierPath.slice(0, -".json".length)}.rulings.json`
      : `${carrierPath}.rulings.json`;
  }

  /** The sidecar's rulings as recorded — null when the file is absent, unparsable or
   *  does not carry a rulings array. The lenient read is for callers that render a
   *  ruling, never for the gate: the dispatch gate judges through `verdict`. */
  static read(carrierPath: string): { readonly rulings: readonly Ruling[] } | null {
    const parsed = CarrierRulings.#parse(CarrierRulings.pathFor(carrierPath));
    if (parsed.kind !== "ok") return null;
    return CarrierRulings.#lenientRulings(parsed.value);
  }

  /** The strict judgment — the fix dispatch's pre-spawn gate. `findingIds` is the
   *  carrier's own finding-id set: a ruling on a finding the carrier does not carry is
   *  refused, never carried into the round as a phantom. */
  static verdict(carrierPath: string, findingIds: ReadonlySet<string>): RulingVerdict {
    const sidecar = CarrierRulings.pathFor(carrierPath);
    const parsed = CarrierRulings.#parse(sidecar);
    if (parsed.kind !== "ok") return parsed;
    const record = CarrierRulings.#recordOf(parsed.value);
    if (record === null) {
      return CarrierRulings.#invalid(sidecar, "the sidecar is not a JSON object");
    }
    if (!CarrierRulings.#keysWithin(record, TOP_KEYS)) {
      return CarrierRulings.#invalid(
        sidecar,
        `unknown top-level key(s) — the schema declares ${[...TOP_KEYS].join(" / ")}`,
      );
    }
    const carrierRefusal = CarrierRulings.#carrierRefusal(record, carrierPath);
    if (carrierRefusal !== null) return CarrierRulings.#invalid(sidecar, carrierRefusal);
    if (!("rulings" in record)) {
      return CarrierRulings.#invalid(sidecar, "the sidecar carries no `rulings` array");
    }
    if (!Array.isArray(record.rulings)) {
      return CarrierRulings.#invalid(sidecar, "`rulings` is not an array");
    }
    const rulings: Ruling[] = [];
    for (const [index, entry] of record.rulings.entries()) {
      const ruling = CarrierRulings.#rulingOf(entry, index, findingIds);
      if (typeof ruling === "string") return CarrierRulings.#invalid(sidecar, ruling);
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

  /** One ruling entry — the narrowed record, or the refusal's reason string. */
  static #rulingOf(
    entry: unknown,
    index: number,
    findingIds: ReadonlySet<string>,
  ): Ruling | string {
    const record = CarrierRulings.#recordOf(entry);
    if (record === null) return `ruling #${index + 1} is not a JSON object`;
    const unknown = Object.keys(record).filter((key) => !RULING_KEYS.has(key));
    if (unknown.length > 0) {
      return `ruling #${index + 1} carries unknown key(s) — ${unknown.join(", ")}`;
    }
    const { finding, ruling, at, by } = record;
    if (typeof finding !== "string") return `ruling #${index + 1} carries no string \`finding\``;
    if (typeof ruling !== "string") return `ruling #${index + 1} carries no string \`ruling\``;
    if (at !== undefined && typeof at !== "string") {
      return `ruling #${index + 1} carries a non-string \`at\``;
    }
    if (by !== undefined && typeof by !== "string") {
      return `ruling #${index + 1} carries a non-string \`by\``;
    }
    if (!findingIds.has(finding)) {
      return `ruling #${index + 1} answers ${finding}, which is not a finding of the carrier`;
    }
    return {
      finding,
      ruling,
      ...(at === undefined ? {} : { at }),
      ...(by === undefined ? {} : { by }),
    };
  }

  /** The lenient rulings read — null unless every entry carries the two required
   *  strings (an unknown key is tolerated here; the strict gate owns that refusal). */
  static #lenientRulings(value: unknown): { readonly rulings: readonly Ruling[] } | null {
    const record = CarrierRulings.#recordOf(value);
    if (record === null || !Array.isArray(record.rulings)) return null;
    const rulings: Ruling[] = [];
    for (const entry of record.rulings) {
      const row = CarrierRulings.#recordOf(entry);
      if (row === null) return null;
      const { finding, ruling, at, by } = row;
      if (typeof finding !== "string" || typeof ruling !== "string") return null;
      rulings.push({
        finding,
        ruling,
        ...(typeof at === "string" ? { at } : {}),
        ...(typeof by === "string" ? { by } : {}),
      });
    }
    return { rulings };
  }
}
