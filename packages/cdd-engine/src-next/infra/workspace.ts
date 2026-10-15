// packages/cdd-engine/src-next/infra/workspace.ts
// T12 — the workspace data plane: the WorkspaceRoot + Workspace pair owns every
// on-disk workspace concern of the new tree.
//   WorkspaceRoot — the repo-scoped workspace base (`<repoRoot>/<workspaceRoot>`,
//     one dispatch family's home; the segment single-sources the engine config's
//     handoffNamespace.workspaceRoot and is never a hard-coded literal).
//   Workspace     — one dispatch workspace (`<base>/<slug>/`): ensure() mkdirs the
//     slug dir, readJson/writeJson are the JSON read/write pair (mkdir before
//     write; readJson is tri-state — ok / missing / malformed), resolve() is the
//     child-path single fact, slugFromDoc is the doc-file → slug derivation
//     (`-design`/`-plan` suffix strip), docsOfSlug is the slug → doc-tree reverse
//     derivation (the board's file-system-only truth, phase-suffix parse included).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** The tri-state JSON read — the read's three DISTINCT outcomes, discriminated: a
 *  `missing` file (never written) and a `malformed` file (present but unparseable)
 *  are different facts, so a read-back reconstruct reports each truly — a corrupt
 *  draft is never misreported as "not written" (D27 · single-fact honesty). The
 *  other-IO-error case (EACCES, EISDIR …) is a present-but-unreadable file and rides
 *  the `malformed` side: it is never silently "missing". */
export type JsonRead<T> = { kind: "ok"; value: T } | { kind: "missing" } | { kind: "malformed" };

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
   *  (null when the slug is a program slug, i.e. carries no phase suffix). */
  static phaseSuffixOf(slug: string): string | null {
    const match = /(?<program>.+?)(?<suffix>-p\d+(?:\.\d+)*)$/.exec(slug);
    return match?.groups?.suffix ?? null;
  }

  /** The slug → doc-tree reverse derivation: from a program or phase slug, derive
   *  the artifact paths the doc tree should carry, judged by `existsSync` (the
   *  file system is the only truth — an absent file is null, never synthesized).
   *  A phase slug's overall anchors at the nearest existing `<ancestor>-overall.md`
   *  walking up the dotted phase path (`-p7.1` → `-p7` → program root) — no
   *  overall-declared table is parsed (the Phase inventory is stale-prone). */
  static docsOfSlug(slug: string, repoRoot: string): SlugDocs {
    const specs = path.join(repoRoot, "docs/kairos/specs");
    const plans = path.join(repoRoot, "docs/kairos/plans");
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
   *  never silently "missing" — the reconstruct reports the true cause). */
  readJson<T>(name: string): JsonRead<T> {
    const target = this.resolve(name);
    let text: string;
    try {
      text = readFileSync(target, "utf8");
    } catch (raw) {
      const code = (raw as { code?: unknown }).code;
      return code === "ENOENT" ? { kind: "missing" } : { kind: "malformed" };
    }
    try {
      return { kind: "ok", value: JSON.parse(text) as T };
    } catch {
      return { kind: "malformed" };
    }
  }

  /** Write a JSON child — mkdir before write. */
  writeJson(name: string, value: unknown): void {
    this.ensure();
    writeFileSync(this.resolve(name), JSON.stringify(value, null, 2), "utf8");
  }
}
