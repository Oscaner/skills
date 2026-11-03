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
//     child-path single fact. Document identity is NOT derived here: the workspace
//     key is the document's declared `slug:`, judged by the ONE identity index
//     (infra/slug-index.ts).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type ParseError, parse } from "jsonc-parser";
import { AtomicWriter } from "./atomic.ts";
import { RepoRoot } from "./root.ts";

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

/** The persisted path-field keys — the JSON fields whose value is a PATH (the
 *  progress.json `reviewedRevision.doc` / `.plan` layers · the base.json `plan`
 *  field). The read-time normalization (P9 T4 §2.11) relativizes exactly these
 *  values, never an arbitrary string (a carrier's `notes` prose is never treated as
 *  a path). */
const PERSISTED_PATH_KEYS: ReadonlySet<string> = new Set(["doc", "plan"]);

/** The repo-scoped workspace base — `<repoRoot>/<workspaceRoot>`. */
export class WorkspaceRoot {
  readonly repoRoot: string;
  /** The repo-basis value object (T1 `RepoRoot`) — constructed ONCE here, at the
   *  workspace's own boundary, and shared by every reader that needs the basis
   *  (the ledger's write/read normalization, the CLI's capsule/graph render, the
   *  board's doc cells): the single repo-basis fact is threaded as the value object,
   *  never re-wrapped per call (branch-review-1 F2 — Data Clumps / Primitive
   *  Obsession: one basis, one form). */
  readonly basis: RepoRoot;
  readonly path: string;

  constructor(repoRoot: string, workspaceRoot: string) {
    this.repoRoot = repoRoot;
    this.basis = new RepoRoot(repoRoot);
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

/** One dispatch workspace — `<base>/<slug>/`. */
export class Workspace {
  readonly root: WorkspaceRoot;
  readonly slug: string;
  readonly path: string;
  /** The JSON write seam — every engine-persisted artifact rides it. */
  readonly #atomic = new AtomicWriter();

  constructor(root: WorkspaceRoot, slug: string) {
    this.root = root;
    this.slug = slug;
    this.path = path.join(root.path, slug);
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

  /** Write a JSON child — mkdir before write, and the bytes land through the ONE
   *  atomic write seam (`AtomicWriter`): a killed process leaves the previous whole
   *  document, never half a JSON body. The declared path fields (`doc` /
   *  `plan`) are normalized to the canonical repoRoot-relative shape on write (P9
   *  T4 §2.7), so every engine-persisted path field lands relative — the read-time
   *  backstop then only covers legacy bytes (migration handles history, the read
   *  normalizes any straggler). The written bytes carry exactly one trailing `\n`
   *  (the repo's EOF rule), so an engine-written file is byte-canonical and the
   *  one-time migration leaves it byte-identical (zero churn). */
  writeJson(name: string, value: unknown): void {
    this.ensure();
    const normalized = this.#normalizePaths(value);
    this.#atomic.write(this.resolve(name), `${JSON.stringify(normalized, null, 2)}\n`);
  }

  /** Write a text child — mkdir before write (the text twin of `writeJson`; the
   *  engine-rendered brief is the one text artifact the engine authors itself).
   *  Returns the resolved path. */
  writeText(name: string, text: string): string {
    this.ensure();
    const target = this.resolve(name);
    writeFileSync(target, text, "utf8");
    return target;
  }

  /** The workspace's repo-basis value object — the ONE conversion exit the
   *  read-time path backstop normalizes through. The basis is the root's OWN
   *  value object (`WorkspaceRoot.basis`, built once at the root's boundary) —
   *  never re-wrapped here (branch-review-1 F2: one basis, one form). */
  #repoBasis(): RepoRoot {
    return this.root.basis;
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
