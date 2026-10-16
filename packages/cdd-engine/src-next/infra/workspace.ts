// packages/cdd-engine/src-next/infra/workspace.ts
// T12 — the workspace data plane: the WorkspaceRoot + Workspace pair owns every
// on-disk workspace concern of the new tree.
//   WorkspaceRoot — the repo-scoped workspace base (`<repoRoot>/<workspaceRoot>`,
//     one dispatch family's home; the segment single-sources the engine config's
//     handoffNamespace.workspaceRoot and is never a hard-coded literal).
//   Workspace     — one dispatch workspace (`<base>/<slug>/`): ensure() mkdirs the
//     slug dir, readJson/writeJson are the JSON read/write pair (mkdir before
//     write; readJson is tri-state — ok / missing / malformed), readJsonLenient is
//     the sub-agent-authored draft face (jsonc-parser + trailing-comma/comment
//     tolerance — a child-LLM slip never voids a round, a real break still reports
//     malformed; D39), resolve() is the
//     child-path single fact, slugFromDoc is the doc-file → slug derivation
//     (`-design`/`-plan` suffix strip), docsOfSlug is the slug → doc-tree reverse
//     derivation (the board's file-system-only truth, phase-suffix parse included).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type ParseError, parse } from "jsonc-parser";
import { RepoRoot } from "./root.ts";
import { ENGINE_RUNTIME } from "./runtime.ts";

/** The tri-state JSON read — the read's three DISTINCT outcomes, discriminated: a
 *  `missing` file (never written) and a `malformed` file (present but unparseable)
 *  are different facts, so a read-back reconstruct reports each truly — a corrupt
 *  draft is never misreported as "not written" (D27 · single-fact honesty). The
 *  other-IO-error case (EACCES, EISDIR …) is a present-but-unreadable file and rides
 *  the `malformed` side: it is never silently "missing". The lenient face (D39)
 *  carries the parser's PRECISE error codes on the `malformed` side for diagnosis
 *  (the strict face and the IO-error case leave `errors` absent). */
export type JsonRead<T> =
  | { kind: "ok"; value: T }
  | { kind: "missing" }
  | { kind: "malformed"; errors?: readonly ParseError[] };

/** The slug phase-suffix syntax — the trailing `-p<major>(.<minor>)*` segment
 *  (spec §3.2 ⑬). This is the ONE source of the phase-suffix grammar: both the
 *  suffix parse (`Workspace.phaseSuffixOf`, the `-p…$` form) and the board's
 *  suffix-only match (`BoardView.scanPhases`, the `^p…$` form) compose their
 *  patterns from this fragment. (Distinct from the doc-contract design-unit value
 *  syntax `P\d+(\.\d+)*-design` — uppercase + `-design` tail — which is another
 *  fact, never merged here.) */
export const PHASE_SUFFIX_CORE = "p\\d+(?:\\.\\d+)*";

/** The phase-suffix parse — the trailing `-p<major>(.<minor>)*` segment captured
 *  as the named `suffix` group (composed from PHASE_SUFFIX_CORE: the ONE grammar). */
const PHASE_SUFFIX_TAIL = new RegExp(`(?<program>.+?)(?<suffix>-${PHASE_SUFFIX_CORE})$`);

/** The suffix-only match — a bare `<major>(.<minor>)*` phase path (composed from
 *  the SAME PHASE_SUFFIX_CORE; the board's scan uses this form). */
export const PHASE_SUFFIX_BARE = new RegExp(`^${PHASE_SUFFIX_CORE}$`);

/** The persisted path-field keys — the JSON fields whose value is a PATH (the
 *  progress.json `reviewedRevision.doc` / `.plan` layers · the base.json `plan`
 *  field). The read-time normalization (P9 T4 §2.11) relativizes exactly these
 *  values, never an arbitrary string (a carrier's `notes` prose is never treated as
 *  a path). */
const PERSISTED_PATH_KEYS: ReadonlySet<string> = new Set(["doc", "plan"]);

/** The repo-scoped workspace base — `<repoRoot>/<workspaceRoot>`. */
export class WorkspaceRoot {
  readonly repoRoot: string;
  readonly path: string;

  constructor(repoRoot: string, workspaceRoot: string) {
    this.repoRoot = repoRoot;
    this.path = path.join(repoRoot, workspaceRoot);
  }

  /** Idempotently create the workspace root + self-publish the namespace root's
   *  `.gitignore` (a single `*` — everything under `.kairos/` is engine-owned, so
   *  the git face ignores the whole namespace wholesale, the `cdd/` workspace and
   *  any future sibling alike). The tree-clean gate then reads git's own judgment
   *  — `isClean` with zero engine-side exclusion — a consumer repo with no `.kairos`
   *  entry in its own `.gitignore` still stays clean across dispatches, because
   *  the workspace publishes its keep-out marker at ensure time, before the gate
   *  ever reads the tree (the F1 fix: the engine's run artifacts are engine-owned,
   *  never "uncommitted user work"). The ignore affects only untracked files — a
   *  user who git-tracks the workspace keeps seeing its changes on the gate. */
  ensure(): WorkspaceRoot {
    mkdirSync(this.path, { recursive: true });
    // The namespace root — the workspace root's parent (`.kairos/cdd` → `.kairos`):
    // the keep-out marker sits at the namespace's top, never per-workspace (the
    // consumer-facing convention: ignore the whole `.kairos` namespace at once).
    const namespaceRoot = path.dirname(this.path);
    mkdirSync(namespaceRoot, { recursive: true });
    const ignore = path.join(namespaceRoot, ".gitignore");
    if (!existsSync(ignore)) writeFileSync(ignore, "*\n", "utf8");
    return this;
  }
}

/** One slug's doc-tree paths — the reverse-derived artifact paths of a program or
 *  phase slug (each member null when the file does not exist on disk; the file
 *  system is the only truth, nothing is synthesized). */
export interface SlugDocs {
  /** The program's overall spec (`specs/<program>-overall.md`); null when absent. */
  overall: string | null;
  /** The phase's design spec (`specs/<slug>-design.md`); null when absent or the
   *  slug is a program slug. */
  spec: string | null;
  /** The phase's plan (`plans/<slug>.md`); null when absent or the slug is a
   *  program slug. */
  plan: string | null;
  /** The phase suffix (`-p7`, `-p4.1`, `-p3.2.1` …); null for a program slug. */
  phaseSuffix: string | null;
}

/** One dispatch workspace — `<base>/<slug>/`. */
export class Workspace {
  readonly root: WorkspaceRoot;
  readonly slug: string;
  readonly path: string;

  constructor(root: WorkspaceRoot, slug: string) {
    this.root = root;
    this.slug = slug;
    this.path = path.join(root.path, slug);
  }

  /** The doc-file → slug derivation: strip `.md`, then one trailing `-design` or
   *  `-plan` suffix (anchored, mutually exclusive — spec and plan converge). */
  static slugFromDoc(doc: string): string {
    const base = path.basename(doc).replace(/\.md$/, "");
    return base.replace(/-(?:design|plan)$/, "");
  }

  /** The slug's phase-suffix parse — the trailing `-p<major>(.<minor>)*` segment
   *  (null when the slug is a program slug, i.e. carries no phase suffix). The
   *  grammar is PHASE_SUFFIX_TAIL, composed from the shared PHASE_SUFFIX_CORE. */
  static phaseSuffixOf(slug: string): string | null {
    const match = PHASE_SUFFIX_TAIL.exec(slug);
    return match?.groups?.suffix ?? null;
  }

  /** The slug → doc-tree reverse derivation: from a program or phase slug, derive
   *  the artifact paths the doc tree should carry, judged by `existsSync` (the
   *  file system is the only truth — an absent file is null, never synthesized).
   *  A phase slug's overall anchors at the nearest existing `<ancestor>-overall.md`
   *  walking up the dotted phase path (`-p7.1` → `-p7` → program root) — no
   *  overall-declared table is parsed (the Phase inventory is stale-prone). */
  static docsOfSlug(slug: string, repoRoot: string): SlugDocs {
    const specs = path.join(repoRoot, ENGINE_RUNTIME.docRoots.specs);
    const plans = path.join(repoRoot, ENGINE_RUNTIME.docRoots.plans);
    const suffix = Workspace.phaseSuffixOf(slug);
    if (suffix === null) {
      const overall = path.join(specs, `${slug}-overall.md`);
      return {
        overall: existsSync(overall) ? overall : null,
        spec: null,
        plan: null,
        phaseSuffix: null,
      };
    }
    const overall = Workspace.#nearestOverall(specs, slug, suffix);
    const spec = path.join(specs, `${slug}-design.md`);
    const plan = path.join(plans, `${slug}.md`);
    return {
      overall,
      spec: existsSync(spec) ? spec : null,
      plan: existsSync(plan) ? plan : null,
      phaseSuffix: suffix,
    };
  }

  /** The nearest existing overall anchor walking up the dotted phase path: for a
   *  deep suffix (`-p7.1`) the candidates are `<program>-p7`, then the program
   *  root; for a single-segment suffix the program root only. Null when no
   *  candidate's overall file exists — nothing synthesized. */
  static #nearestOverall(specs: string, slug: string, suffix: string): string | null {
    const stem = slug.slice(0, slug.length - suffix.length);
    const segments = suffix.slice(2).split(".");
    for (let keep = segments.length - 1; keep >= 0; keep--) {
      const candidate =
        keep === 0
          ? path.join(specs, `${stem}-overall.md`)
          : path.join(specs, `${stem}-p${segments.slice(0, keep).join(".")}-overall.md`);
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  /** Idempotently create the workspace directory. */
  ensure(): Workspace {
    this.root.ensure();
    mkdirSync(this.path, { recursive: true });
    return this;
  }

  /** A child path inside this workspace. */
  resolve(name: string): string {
    return path.join(this.path, name);
  }

  /** Read a JSON child — the tri-state face: `{kind:"ok",value}` on a present,
   *  parseable file; `{kind:"missing"}` when the path does not exist; `{kind:
   *  "malformed"}` when the file is present but its bytes are unparseable (a bad
   *  JSON draft) OR unreadable for any other I/O reason (a present-but-broken file is
   *  never silently "missing" — the reconstruct reports the true cause). The STRICT
   *  read — engine-authored files (`JSON.stringify` output) are always legal JSON, so
   *  they never need leniency; a lenient read of a strict file would only mask a real
   *  engine bug. */
  readJson<T>(name: string): JsonRead<T> {
    const target = this.resolve(name);
    const text = this.#readText(target);
    if (text.kind !== "ok") return text;
    try {
      // The read-time path backstop (P9 T4 §2.11): a path field persisted by an
      // older build (an absolute form) is relativized on read, so an un-migrated
      // file still yields the ONE canonical shape downstream. A no-op on
      // already-relative values (relativize is idempotent).
      return { kind: "ok", value: this.#normalizePaths(JSON.parse(text.value)) as T };
    } catch {
      return { kind: "malformed" };
    }
  }

  /** Read a JSON child LENIENTLY — the sub-agent-authored handoff-draft face (D39).
   *  A child LLM writes handoff carriers (`tasks-*-implement.json` …) from prose, and
   *  a trailing comma or a stray comment is a routine model slip, not a real defect —
   *  the strict `readJson` vetoes the WHOLE implement+review round on one such comma
   *  (the W3 {5,11} block: a `notes` array trailing comma, the draft otherwise whole).
   *  jsonc-parser with `allowTrailingComma` tolerates ONLY the lenient-dialect surface
   *  (trailing commas · comments) and still reports a real break (a missing brace, …)
   *  — so a corrupt draft stays fail-loud while a cosmetic slip no longer voids a round.
   *  The leniency is scoped to THIS face alone: engine-authored files (including the
   *  test-evidence sibling, which the engine/child writes as machine JSON) keep the
   *  strict `readJson` — the JSON contract is never widened for engine bytes. */
  readJsonLenient<T>(name: string): JsonRead<T> {
    const target = this.resolve(name);
    const text = this.#readText(target);
    if (text.kind !== "ok") return text;
    const errors: ParseError[] = [];
    const value = parse(text.value, errors, {
      allowTrailingComma: true,
      disallowComments: false,
    }) as T;
    // A real break carries the parser's precise error codes (offset/length/error)
    // for diagnosis; a tolerated slip parses clean (errors empty).
    return errors.length === 0 ? { kind: "ok", value } : { kind: "malformed", errors };
  }

  /** Read a child's text — the shared tri-state file leg of both JSON reads: a
   *  genuinely absent path is `missing`; a present-but-unreadable one (EACCES, EISDIR …)
   *  is `malformed` — never silently "missing" (D27 · single-fact honesty). */
  #readText(target: string): { kind: "ok"; value: string } | JsonRead<never> {
    let text: string;
    try {
      text = readFileSync(target, "utf8");
    } catch (raw) {
      const code = (raw as { code?: unknown }).code;
      return code === "ENOENT" ? { kind: "missing" } : { kind: "malformed" };
    }
    return { kind: "ok", value: text };
  }

  /** Write a JSON child — mkdir before write. The declared path fields (`doc` /
   *  `plan`) are normalized to the canonical repoRoot-relative shape on write (P9
   *  T4 §2.7), so every engine-persisted path field lands relative — the read-time
   *  backstop then only covers legacy bytes (migration handles history, the read
   *  normalizes any straggler). The written bytes carry exactly one trailing `\n`
   *  (the repo's EOF rule), so an engine-written file is byte-canonical and the
   *  one-time migration leaves it byte-identical (zero churn). */
  writeJson(name: string, value: unknown): void {
    this.ensure();
    const normalized = this.#normalizePaths(value);
    writeFileSync(this.resolve(name), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  }

  /** The workspace's repo-basis value object — the ONE conversion exit the
   *  read-time path backstop normalizes through (T1 `RepoRoot`; the workspace
   *  owns the slug, its root owns the basis). */
  #repoBasis(): RepoRoot {
    return new RepoRoot(this.root.repoRoot);
  }

  /** One-time legacy migration of a persisted JSON child (P9 T4 §2.11) — the
   *  historical half of the shapes fix: a `progress.json` / `base.json` written by
   *  an older build may carry an absolute (or otherwise redundant) path field. The
   *  raw bytes are read, their declared path fields normalized, and the file is
   *  REWRITTEN ONLY when the normalization actually changes bytes (an already-clean
   *  file is left byte-identical — zero churn). A missing or unparseable file is a
   *  no-op (the read face owns the malformed report; migration never fabricates). */
  migrateJsonChild(name: string): void {
    const target = this.resolve(name);
    let raw: string;
    try {
      raw = readFileSync(target, "utf8");
    } catch {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const normalized = `${JSON.stringify(this.#normalizePaths(parsed), null, 2)}\n`;
    if (normalized !== raw) writeFileSync(target, normalized, "utf8");
  }

  /** The read-time path backstop (P9 T4 §2.11) — deep-normalize every DECLARED
   *  path field (`doc` / `plan` — the `reviewedRevision` two-layer layers + the
   *  base artifact's `plan`) to the canonical repoRoot-relative shape, so an
   *  un-migrated file (a legacy absolute value) still reads as the ONE shape.
   *  Only the declared path keys are touched (never arbitrary prose); the walk is
   *  a pure clone (arrays + plain objects), recursing into `waves[]` rows and the
   *  reviewed-revision records alike. Relativizing an already-relative value is a
   *  no-op (idempotent). */
  #normalizePaths(value: unknown): unknown {
    const root = this.#repoBasis();
    const walk = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(walk);
      if (node !== null && typeof node === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
          out[key] =
            PERSISTED_PATH_KEYS.has(key) && typeof child === "string"
              ? root.relativize(child)
              : walk(child);
        }
        return out;
      }
      return node;
    };
    return walk(value);
  }
}
