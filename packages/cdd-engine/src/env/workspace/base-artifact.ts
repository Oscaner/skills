// packages/cdd-engine/src/env/workspace/base-artifact.ts
// The base artifact: the CDD `--plan` target's read/write row — the branch the plan's
// line rides, the channel that named it, the plan path it serves and when it landed.
//
// Two external facts arrive as constructor arguments and are never read here: `now`
// (the clock) and `baseName` (the artifact's file name, derived from the artifact
// matrix by the composition root). Neither carries a default — a defaulted clock makes
// `recordedAt` a second truth, and a defaulted file name puts the spelling matrix in a
// second home.
//
// The conflict judgment lives HERE, not in a command shell: an existing artifact whose
// base differs from the requested one refuses without `--force`. The bytes of that
// refusal belong to the render face; this module returns the decided value.

import type { RepoPath } from "../paths/root.ts";

/** The declared `--source` domain of the base artifact — the ONE value set. The CLI
 *  flag's enum derives from this array, never from a second spelling. */
export const BASE_SOURCES = [
  "plan-field",
  "branch-upstream",
  "conversation-context",
  "user-confirmed",
] as const;

/** One channel that can name the base branch. */
export type BaseSource = (typeof BASE_SOURCES)[number];

/** The base artifact's declared field set, in canonical order — the runtime companion
 *  of `BaseValue`. The documented `base.md` schema table derives from this tuple. */
export const BASE_ARTIFACT_FIELDS = ["base", "source", "plan", "recordedAt"] as const;

/** The base artifact's value. */
export interface BaseValue {
  readonly base: string;
  readonly source: BaseSource;
  readonly plan: RepoPath;
  readonly recordedAt: string;
}

/** A JSON child's three DISTINCT read outcomes: a `missing` file (never written) and
 *  a `malformed` file (present but unparseable, or unreadable for any other reason)
 *  are different facts, so a read-back reports neither as the other. */
export type JsonRead<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "missing" }
  | { readonly kind: "malformed" };

/** The base artifact's read outcome. Both absence variants carry the artifact's
 *  repo-relative path: the `at <path>` byte of `base get` is filled from it, so the
 *  read face never answers a bare `null`. */
export type BaseRead =
  | { readonly kind: "artifact"; readonly value: BaseValue }
  | { readonly kind: "absent"; readonly target: RepoPath }
  | { readonly kind: "corrupt"; readonly target: RepoPath };

/** The base artifact's write outcome: `conflict` carries the standing artifact so the
 *  refusal can name it; a forced or first write is `written`. */
export type BaseWrite =
  | { readonly kind: "written"; readonly target: RepoPath }
  | { readonly kind: "conflict"; readonly target: RepoPath; readonly existing: BaseValue };

/** What the artifact needs from its workspace: the JSON read/write pair and the
 *  repo-relative spelling of one child name. Injected because the file system is a
 *  boundary — the workspace is the only lander, and a test drives the same class over
 *  an in-memory home. */
export interface BaseHome {
  /** Read one workspace child as JSON. */
  readJson(name: string): JsonRead<unknown>;
  /** Write one workspace child as JSON; the landed bytes end with exactly one `\n`. */
  writeJson(name: string, value: unknown): RepoPath;
  /** One workspace child's repo-relative path. */
  relOf(name: string): RepoPath;
}

/** The facts a `set` request carries. */
export interface BaseWriteInput {
  readonly base: string;
  readonly source: BaseSource;
  readonly plan: RepoPath;
  /** `--force` — override a standing artifact whose base differs. */
  readonly force?: boolean;
}

/**
 * BaseArtifact — one workspace's base artifact. Invariant: a write either lands a
 * whole artifact or refuses with the standing one; a read answers artifact / absent /
 * corrupt, each carrying the artifact's repo-relative path. Immutable collaborators;
 * one instance serves every call of its workspace.
 */
export class BaseArtifact {
  readonly #home: BaseHome;
  readonly #now: () => number;
  readonly #baseName: string;

  constructor(opts: { home: BaseHome; now: () => number; baseName: string }) {
    if (typeof opts.now !== "function") {
      throw new Error("BaseArtifact: `now` is required (no default clock)");
    }
    if (typeof opts.baseName !== "string" || opts.baseName.length === 0) {
      throw new Error("BaseArtifact: `baseName` is required (no default file name)");
    }
    this.#home = opts.home;
    this.#now = opts.now;
    this.#baseName = opts.baseName;
  }

  /** The artifact's repo-relative path — the `at <path>` filler of every read face. */
  target(): RepoPath {
    return this.#home.relOf(this.#baseName);
  }

  /** Read the artifact. A present-but-unreadable or schema-invalid record is
   *  `corrupt`; a never-written one is `absent`. Never throws, never bare null. */
  read(): BaseRead {
    const target = this.target();
    const read = this.#home.readJson(this.#baseName);
    if (read.kind === "missing") return { kind: "absent", target };
    if (read.kind === "malformed") return { kind: "corrupt", target };
    const value = BaseArtifact.valueOf(read.value);
    return value === null ? { kind: "corrupt", target } : { kind: "artifact", value };
  }

  /** Write the artifact. A standing artifact whose base differs refuses unless the
   *  request carries `force`; the artifact then lands whole and read-only-writable by
   *  the owner's own write face. */
  write(input: BaseWriteInput): BaseWrite {
    const target = this.target();
    const existing = this.read();
    if (
      existing.kind === "artifact" &&
      existing.value.base !== input.base &&
      input.force !== true
    ) {
      return { kind: "conflict", target, existing: existing.value };
    }
    const value: BaseValue = {
      base: input.base,
      source: input.source,
      plan: input.plan,
      recordedAt: new Date(this.#now()).toISOString(),
    };
    this.#home.writeJson(this.#baseName, value);
    return { kind: "written", target };
  }

  /** Narrow a raw JSON payload to a base artifact, or null. Every declared field must
   *  be a string and `source` must lie in the declared domain — a payload outside the
   *  schema is corrupt, never a fabricated artifact. The field walk reads
   *  `BASE_ARTIFACT_FIELDS`, so the reader cannot drift from the declared field set. */
  static valueOf(raw: unknown): BaseValue | null {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    for (const field of BASE_ARTIFACT_FIELDS) {
      if (typeof record[field] !== "string") return null;
    }
    const source = record.source as string;
    if (!(BASE_SOURCES as readonly string[]).includes(source)) return null;
    return {
      base: record.base as string,
      source: source as BaseSource,
      plan: record.plan as RepoPath,
      recordedAt: record.recordedAt as string,
    };
  }
}
