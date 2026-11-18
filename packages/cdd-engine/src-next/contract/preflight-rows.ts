// packages/cdd-engine/src-next/contract/preflight-rows.ts
// P40 T3 — the four pre-dispatch judgments as a PURE value judgment. `no-host` ·
// `carrier` · `dispatch-input` · `artifact` used to be four instance methods of the
// face's `CliLifecycle`; they are judgments over VALUES (the dispatched values, the
// row's declarations, two declared scene facts, one artifact snapshot and the host
// probe), so they belong on the contract plane, where the seam that will call them
// (P40 T4) is allowed to read.
//
// The judgment's definition comes from the DECLARATION, never from a second table: the
// cells it judges are the ones `ExigibleCells.resolve` derives from the row's
// `ContextLine` declarations. Its wording is INJECTED (`RowWording`), so this module
// holds no sentence of the four rows; the carrier line's one FORMAT lives in
// `carrier-line.ts`, and the carrier row's sentence is composed there.
//
// Plane direction is the point of the extraction: no `face/` type, no `render/` type,
// no `session/` type. The face adapts at its call site (the flat `TemplateValues`
// record, `layoutOf`'s declarations verbatim, the scene facts as booleans, the private
// artifact cell mapped to the snapshot below, and the words table's rows).
//
// Module-level exports are types / the class — zero behavior-carrying bare functions.

import type { RepoPath, RepoRoot } from "../infra/root.ts";
import { type CarrierFacts, CarrierLine } from "./carrier-line.ts";
import {
  type ContextLine,
  type ExigibleCell,
  ExigibleCells,
  type ExigibleReason,
  type SceneFacts,
} from "./context-declarations.ts";
import type { DocFs } from "./invariants.ts";
import type { TargetType } from "./target-type.ts";

/** The four refusal stations — one word per judgment, and (P40) one word per
 *  structure-leg row. The names are the closed set; a fifth judgment adds a word here
 *  first. */
export type RowStation = "no-host" | "carrier" | "dispatch-input" | "artifact";

/** The dispatch facts the judgment reads ITSELF — two cells only, because every other
 *  fact already has a home and a second copy here would be the same fact twice:
 *  `tasks` / `(cycle, attempt)` live in the composer's identity cell, the three path
 *  links in the scene cell, the `--reviews` carrier path in the snapshot's
 *  `reviewsPath`. */
export interface DispatchInputFacts {
  /** The dispatch's target type — the argument `requiredOn`'s type arms are resolved
   *  against (`ExigibleCells.resolve`'s third parameter). */
  readonly type: TargetType;
  /** The host probe's result; the empty string means "no host harness" and is the
   *  `no-host` row's only input. */
  readonly host: string;
}

/** One refusal — the station that refused and the reason it prints. */
export interface RowRefusal {
  readonly station: RowStation;
  /** Multi-line: the first line is the conclusion, the following lines are
   *  `derived:` / `found:` / `identity:` / `repair:`. The first line MAY start with
   *  the station word (`dispatch-input`'s wording carries it; that literal is
   *  unchanged) — the seam strips a leading station word when it derives the single
   *  stored `detail`, and `DispatchAuthority#message` puts it back on, so the station is
   *  added in one place and removed in one place. */
  readonly detail: string;
}

/** The artifact judgment's contract-plane snapshot — the mirror of the face's private
 *  `ArtifactCell`, carrying only the FLAT facts the judgment reads. The `mismatch` arm
 *  carries the carrier's facts (path + two 8-hex prefixes), never the rendered sentence:
 *  `CarrierLine` composes that in one place, and a snapshot holding a pre-rendered
 *  message would be the same fact printed twice.
 *
 *  Both arms carry `reviewsPath` (the fix face's `--reviews` path, or the carrier path
 *  the ledger recorded for the upstream round): it is the COMPOSER's input cell, not a
 *  judgment input — the judgment reads the composer's output (`values`), never this. */
export type ArtifactSnapshot =
  | {
      readonly kind: "mismatch";
      readonly reviewsPath: string | null;
      readonly carrier: CarrierFacts;
    }
  | {
      readonly kind: "read";
      readonly reviewsPath: string | null;
      readonly read: ArtifactSnapshotRead;
    };

/** One artifact read as the judgment reads it — the `ArtifactRead` four arms flattened
 *  into plane-legal values (no `session/` type crosses the plane). */
export interface ArtifactSnapshotRead {
  readonly kind: "absent" | "ok" | "invalid" | "misplaced";
  /** `ok` / `invalid`: the path the read found (`ok`'s path is `INPUT_RULINGS`'s one
   *  source). `misplaced`: the DERIVED name the file should carry. `absent`: null. */
  readonly path: string | null;
  /** The `invalid` arm's own reason, verbatim; null on the other arms. */
  readonly reason: string | null;
  /** Every name that attributes to the identity — the `invalid` / `misplaced` facts. */
  readonly found: readonly string[];
  /** `misplaced`: the identity words the report's `identity:` cell prints (rendered by
   *  the words plane — this plane owns no spelling). Null on the other arms. */
  readonly identity: string | null;
  /** `misplaced`: the artifact kind word the report's first line names (`rulings`),
   *  supplied by the face that performed the read. Null on the arms that name none. */
  readonly sidecarKind: string | null;
}

/** The four rows' wording — the SHAPE is declared here, the VALUES are injected by the
 *  call site, so this module imports no `face/` module and holds no second copy of any
 *  row's bytes. Byte homes: `noHost` in `face/words.ts` (P40 T3 moved it out of the
 *  lifecycle, spec §1.3) · carrier has a FORMAT only, in `contract/carrier-line.ts`
 *  (hence no injection slot) · `dispatchInput` is `CAPSULE_WORDS`' existing row ·
 *  artifact's two arms share `CAPSULE_WORDS.artifactIdentity` (the four `misplaced`
 *  continuation rows and the present-but-unreadable sentence). */
export interface RowWording {
  /** One sentence, no fill slot. */
  readonly noHost: string;
  /** Mirrors `CAPSULE_WORDS.dispatchInput`'s cells plus the table-wide separator: the
   *  judgment joins the segments with `separator` and the station with `stationJoin`,
   *  reproducing today's bytes exactly. */
  readonly dispatchInput: {
    readonly station: string;
    readonly segment: string;
    readonly separator: string;
    readonly stationJoin: string;
  };
  readonly artifact: {
    /** `{reason}` — the present-but-unreadable sidecar sentence. */
    readonly invalid: string;
    /** `{kind}` — the report's first line. */
    readonly reason: string;
    /** `{derived}` — the rendered name. */
    readonly derived: string;
    /** `{found}` — every name found in its place. */
    readonly found: string;
    /** `{identity}` — the identity the rendered name came from. */
    readonly identity: string;
    /** The separator between the `found` names. */
    readonly foundJoin: string;
    /** The word a `found` list with no candidate prints. */
    readonly emptyFound: string;
    /** The fixed repair sentences (the engine only refuses). */
    readonly repair: readonly string[];
  };
}

/** The artifact report's facts — what the `misplaced` arm hands the one composition. */
export interface ArtifactReportFacts {
  /** The artifact kind word the first line names (`rulings`). */
  readonly sidecarKind: string;
  /** The rendered name the file misses. */
  readonly derived: string;
  /** Every name that attributes to the same identity. */
  readonly found: readonly string[];
  /** The identity those facts came from, in the words plane's spelling. */
  readonly identity: string;
}

/** The judgment's whole input as ONE parameter object (a field count is not a parameter
 *  count: the signature takes one argument). The four kinds of fact it reads are all
 *  here: values, declarations, scene facts, snapshot. */
export interface PreFlightRowsInput {
  readonly facts: DispatchInputFacts;
  /** The face's flat value record, in its own shape — zero import. */
  readonly values: Readonly<Record<string, string>>;
  /** The round's resolved declaration row (the face's `layoutOf` output). */
  readonly declarations: readonly ContextLine[];
  readonly scene: SceneFacts;
  readonly artifact: ArtifactSnapshot;
  /** The path-basis value object: the existence read goes through `resolve`, never a
   *  string join — a dispatch started from a subdirectory must not read every landed
   *  path as missing. */
  readonly repoRoot: RepoRoot;
  /** The existence-read seam (the same shape as `JudgeContext`'s `fs`): the seam hands
   *  down the port it was constructed with, so this module constructs no concrete fs
   *  and a recording fake is enough to pin the read. */
  readonly fs: DocFs;
  readonly wording: RowWording;
}

/** The four judgments over one dispatch's values — every violation in one pass (no
 *  short-circuit), in the fixed station order `no-host` → `carrier` →
 *  `dispatch-input` → `artifact`. */
// biome-ignore lint/complexity/noStaticOnlyClass: the four rows' single judgment — the zero-bare-function discipline admits no standalone functions.
export class PreFlightRows {
  static judge(input: PreFlightRowsInput): readonly RowRefusal[] {
    const refusals: RowRefusal[] = [];
    if (input.facts.host === "") {
      refusals.push({ station: "no-host", detail: input.wording.noHost });
    }
    if (input.artifact.kind === "mismatch") {
      refusals.push({ station: "carrier", detail: CarrierLine.of(input.artifact.carrier) });
    }
    const inputDetail = PreFlightRows.#dispatchInputOf(input);
    if (inputDetail !== null) {
      refusals.push({ station: "dispatch-input", detail: inputDetail });
    }
    const artifactDetail = PreFlightRows.#artifactOf(input);
    if (artifactDetail !== null) {
      refusals.push({ station: "artifact", detail: artifactDetail });
    }
    return refusals;
  }

  /** The artifact row's `misplaced` report — THE one composition (the judge and the
   *  words plane's reference renderer both call it, so the two readers of the same
   *  table cannot drift). */
  static artifactReportOf(wording: RowWording["artifact"], facts: ArtifactReportFacts): string {
    const found =
      facts.found.length === 0 ? wording.emptyFound : facts.found.join(wording.foundJoin);
    return [
      wording.reason.replace("{kind}", facts.sidecarKind),
      wording.derived.replace("{derived}", facts.derived),
      wording.found.replace("{found}", found),
      wording.identity.replace("{identity}", facts.identity),
      ...wording.repair,
    ].join("\n");
  }

  /** The `dispatch-input` row over the values about to be rendered — the judged cells
   *  are the declarations' exigible set, all of them reported in one pass (`; `-joined),
   *  so a refused round is repaired once instead of one cell per dispatch. */
  static #dispatchInputOf(input: PreFlightRowsInput): string | null {
    const row = input.values.ROLE ?? "";
    const segments: string[] = [];
    for (const cell of ExigibleCells.resolve(input.declarations, input.scene, input.facts.type)) {
      const reason = PreFlightRows.#reasonOfCell(cell, input);
      if (reason === null) continue;
      const wording = input.wording.dispatchInput;
      segments.push(
        wording.segment
          .replace("{row}", row)
          .replace("{token}", cell.token)
          .replace("{reason}", reason),
      );
    }
    if (segments.length === 0) return null;
    const wording = input.wording.dispatchInput;
    return [wording.station, segments.join(wording.separator)].join(wording.stationJoin);
  }

  /** Why one exigible cell fails, or null when it stands: an empty value earns the
   *  declaration's own word UNLESS the declaration says the engine writes that file
   *  (`written: "engine"` — the engine guarantees it, so the cell is answered on every
   *  face without a second ask), a non-empty path cell is read ONCE through the injected
   *  port, and an engine-written cell takes no existence read at all. The declaration is
   *  the whole answer on both legs: one judgment, one reading, four faces. */
  static #reasonOfCell(cell: ExigibleCell, input: PreFlightRowsInput): ExigibleReason | null {
    const value = input.values[cell.token] ?? "";
    if (value === "") return cell.written === "engine" ? null : cell.reason;
    if (cell.path !== true || cell.written === "engine") return null;
    const absolute = input.repoRoot.resolve(value as RepoPath);
    return input.fs.exists(absolute) ? null : "target-absent";
  }

  /** The `artifact` row over this dispatch's snapshot — the mismatch arm is the
   *  carrier row's, so it answers here with null; the read arm's `invalid` /
   *  `misplaced` arms are the artifact row's two shapes. */
  static #artifactOf(input: PreFlightRowsInput): string | null {
    if (input.artifact.kind !== "read") return null;
    const read = input.artifact.read;
    if (read.kind === "invalid") {
      return input.wording.artifact.invalid.replace("{reason}", read.reason ?? "");
    }
    if (read.kind !== "misplaced") return null;
    return PreFlightRows.artifactReportOf(input.wording.artifact, {
      sidecarKind: read.sidecarKind ?? "",
      derived: read.path ?? "",
      found: read.found,
      identity: read.identity ?? "",
    });
  }
}
