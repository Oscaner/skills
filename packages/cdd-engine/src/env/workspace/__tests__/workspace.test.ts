// packages/cdd-engine/src/env/workspace/__tests__/workspace.test.ts
// The workspace segment's pins:
//   · the base artifact round-trips, its field set is derived from
//     `BASE_ARTIFACT_FIELDS`, its absence variants carry the repo-relative target, and
//     the conflict judgment lives here (a different base refuses without `--force`);
//   · the two injected facts have no defaults: a missing clock or file name throws, a
//     fixed clock reproduces `recordedAt`, a changed name changes the landed file;
//   · every write is atomic: an injected mid-write failure leaves the previous whole
//     bytes and no temporary sibling;
//   · the two text write bases do not cross: the workspace basis lands under the
//     workspace and returns its repo-relative path, the repo basis lands at the very
//     repo-relative target it was given (never under `.kairos/<slug>/`);
//   · `writeFileSync` appears in `src/**` exactly once, in `workspace.ts`, and the
//     zero-clock face covers the three segments this task delivers (the clock's own
//     reader, `env/process/clock.ts`, is outside them);
//   · `ensure` publishes the keep-out marker and creates no slug directory;
//   · `Env` exposes the four segments and takes one options parameter.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { Env } from "../../index.ts";
import { type RepoPath, RepoRoot } from "../../paths/root.ts";
import { Clock } from "../../process/clock.ts";
import type { FileOps } from "../atomic.ts";
import { BASE_ARTIFACT_FIELDS, BASE_SOURCES, BaseArtifact } from "../base-artifact.ts";
import { WorkspaceRoot } from "../workspace.ts";

/** The engine package root — the `src/**` scan's basis. */
const ENGINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** A fixed clock — the pin for `recordedAt`. */
const FIXED_NOW = 1_700_000_000_000;

/** A fixed base artifact file name — the spelling the artifact matrix would derive. */
const BASE_NAME = "base.json";

/** The temp roots this file made, removed after every case. */
const created: string[] = [];

/** A temp directory initialised as a git working tree. */
const tempRepo = (prefix: string): string => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  created.push(directory);
  spawnSync("git", ["init", "-q"], { cwd: directory });
  return directory;
};

/** A workspace family over one temp repo, with the two injected facts pinned. */
const familyOf = (repo: string, ops?: FileOps | undefined): WorkspaceRoot =>
  new WorkspaceRoot({
    basis: RepoRoot.of(repo),
    now: () => FIXED_NOW,
    baseName: BASE_NAME,
    ops,
  });

/** A syscall layout whose writes emit half their bytes and then fail. */
class HalfWritingOps implements FileOps {
  write(file: string): void {
    writeFileSync(file, '{"half": ', "utf8");
    throw new Error("injected write failure");
  }

  rename(): void {
    throw new Error("a half-written file is never renamed");
  }

  remove(file: string): void {
    rmSync(file, { force: true });
  }

  exists(file: string): boolean {
    return existsSync(file);
  }
}

afterEach(() => {
  for (const directory of created.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("the base artifact", () => {
  it("reads back exactly the artifact it wrote, with the declared field set", () => {
    const repo = tempRepo("ws-base-");
    const workspace = familyOf(repo).at("slug-a");
    const base = workspace.baseOf();
    const written = base.write({
      base: "develop",
      source: "plan-field",
      plan: "docs/kairos/plans/p1.md" as RepoPath,
    });
    expect(written.kind).toBe("written");
    const read = base.read();
    expect(read.kind).toBe("artifact");
    if (read.kind !== "artifact") throw new Error("unreachable");
    expect(read.value.base).toBe("develop");
    expect(read.value.source).toBe("plan-field");
    expect(read.value.plan).toBe("docs/kairos/plans/p1.md");
    expect(read.value.recordedAt).toBe(new Date(FIXED_NOW).toISOString());
    // The landed key set is the declared tuple, in order — derived, never typed twice.
    const raw = JSON.parse(readFileSync(workspace.resolve(BASE_NAME), "utf8"));
    expect(Object.keys(raw)).toEqual([...BASE_ARTIFACT_FIELDS]);
  });

  it("reads absence and corruption as declared values carrying the repo-relative target", () => {
    const repo = tempRepo("ws-base-bad-");
    const workspace = familyOf(repo).at("slug-b");
    const base = workspace.baseOf();
    const target = workspace.relOf(BASE_NAME);
    expect(base.read()).toEqual({ kind: "absent", target });
    mkdirSync(workspace.path, { recursive: true });
    writeFileSync(workspace.resolve(BASE_NAME), "{ not json", "utf8");
    expect(base.read()).toEqual({ kind: "corrupt", target });
    expect(base.target()).toBe(target);
  });

  it("refuses a different base without force and writes it with force", () => {
    const repo = tempRepo("ws-base-conflict-");
    const base = familyOf(repo).at("slug-c").baseOf();
    base.write({ base: "develop", source: "plan-field", plan: "p.md" as RepoPath });
    const refused = base.write({
      base: "main",
      source: "user-confirmed",
      plan: "p.md" as RepoPath,
    });
    expect(refused.kind).toBe("conflict");
    if (refused.kind !== "conflict") throw new Error("unreachable");
    expect(refused.existing.base).toBe("develop");
    const forced = base.write({
      base: "main",
      source: "user-confirmed",
      plan: "p.md" as RepoPath,
      force: true,
    });
    expect(forced.kind).toBe("written");
    const read = base.read();
    expect(read.kind === "artifact" ? read.value.base : null).toBe("main");
  });

  it("throws when the clock or the file name is missing, and follows both when given", () => {
    const repo = tempRepo("ws-base-injected-");
    expect(
      () =>
        new BaseArtifact({
          home: familyOf(repo).at("s"),
          now: undefined as never,
          baseName: BASE_NAME,
        }),
    ).toThrow(/now/);
    expect(
      () => new BaseArtifact({ home: familyOf(repo).at("s"), now: () => FIXED_NOW, baseName: "" }),
    ).toThrow(/baseName/);
    const renamed = new BaseArtifact({
      home: familyOf(repo).at("s"),
      now: () => FIXED_NOW,
      baseName: "artifact.json",
    });
    renamed.write({ base: "develop", source: "plan-field", plan: "p.md" as RepoPath });
    const directory = familyOf(repo).at("s").path;
    expect(existsSync(path.join(directory, "artifact.json"))).toBe(true);
    expect(existsSync(path.join(directory, BASE_NAME))).toBe(false);
  });
});

describe("the workspace writes", () => {
  it("leaves the previous whole JSON when a write fails half-way", () => {
    const repo = tempRepo("ws-atomic-json-");
    const healthy = familyOf(repo).at("slug-d");
    healthy.writeJson("progress.json", { waves: [] });
    const before = readFileSync(healthy.resolve("progress.json"), "utf8");
    const broken = familyOf(repo, new HalfWritingOps()).at("slug-d");
    expect(() => broken.writeJson("progress.json", { waves: [1] })).toThrow();
    expect(readFileSync(healthy.resolve("progress.json"), "utf8")).toBe(before);
    expect(readdirSync(healthy.path).sort()).toEqual(["progress.json"]);
  });

  it("lands text on the workspace basis and hands back the same repo-relative path", () => {
    const repo = tempRepo("ws-text-workspace-");
    const workspace = familyOf(repo).at("slug-e");
    const outcome = workspace.writeText("tasks-1-brief.md", "# brief\n");
    expect(outcome.kind).toBe("written");
    if (outcome.kind !== "written") throw new Error("unreachable");
    expect(outcome.target).toBe(".kairos/cdd/slug-e/tasks-1-brief.md");
    expect(workspace.readText(outcome.target)).toEqual({
      kind: "text",
      target: outcome.target,
      value: "# brief\n",
    });
    // The returned path is also the landing point: the file lives under the workspace.
    expect(existsSync(workspace.root.basis.resolve(outcome.target))).toBe(true);
  });

  it("lands text on the repo basis at the target it was given, not under the workspace", () => {
    const repo = tempRepo("ws-text-repo-");
    const workspace = familyOf(repo).at("slug-f");
    const material = "docs/kairos/specs/s1-design.md" as RepoPath;
    mkdirSync(path.join(repo, "docs/kairos/specs"), { recursive: true });
    writeFileSync(path.join(repo, material), "---\nslug: s1\n---\n", "utf8");
    expect(workspace.readText(material)).toEqual({
      kind: "text",
      target: material,
      value: "---\nslug: s1\n---\n",
    });
    const skeleton = "docs/kairos/plans/p9.md" as RepoPath;
    const outcome = workspace.writeTextAt(skeleton, "written body\n");
    expect(outcome).toEqual({ kind: "written", target: skeleton });
    expect(readFileSync(path.join(repo, skeleton), "utf8")).toBe("written body\n");
    expect(existsSync(workspace.resolve(skeleton))).toBe(false);
  });

  it("declares a failed read and a failed write instead of throwing", () => {
    const repo = tempRepo("ws-text-failure-");
    const missing = "docs/kairos/specs/none.md" as RepoPath;
    expect(familyOf(repo).at("s").readText(missing)).toEqual({
      kind: "read-failure",
      target: missing,
    });
    const broken = familyOf(repo, new HalfWritingOps()).at("slug-g");
    const target = "docs/kairos/plans/gone.md" as RepoPath;
    expect(broken.writeTextAt(target, "x\n")).toEqual({ kind: "write-failure", target });
    expect(existsSync(path.join(repo, target))).toBe(false);
  });
});

describe("the landing surface", () => {
  it("keeps `writeFileSync` in one place: `env/workspace/workspace.ts`", () => {
    const offenders = new Scan().filesUsing("writeFileSync");
    expect(offenders).toEqual(["env/workspace/workspace.ts"]);
  });

  it("reads no clock of its own: zero `Date.now` and zero argument-free `new Date(`", () => {
    // The clock face covers exactly the three segments this task delivers — `env/index.ts`,
    // `env/paths/` and `env/workspace/`. The one place in `env/` that reads a clock is
    // `env/process/clock.ts` (T5), which sits outside them; walking all of `src/` here
    // would let a later wave's clock file red a pin this wave owns.
    const scan = new Scan(["env/index.ts", "env/paths", "env/workspace"]);
    expect(scan.filesUsing("Date.now")).toEqual([]);
    expect(scan.filesUsing("new Date()")).toEqual([]);
  });
});

describe("the keep-out marker", () => {
  it("ignores the workspace family and creates no slug directory", () => {
    const repo = tempRepo("ws-keepout-");
    familyOf(repo).ensure();
    const ignored = spawnSync("git", ["check-ignore", "--no-index", ".kairos/cdd/progress.json"], {
      cwd: repo,
      encoding: "utf8",
    });
    expect(ignored.status).toBe(0);
    expect(readdirSync(path.join(repo, ".kairos/cdd"))).toEqual([]);
  });
});

describe("the env facade", () => {
  it("exposes the four segments and nothing else across instance and prototype", () => {
    const repo = tempRepo("env-facade-");
    const env = new Env({
      cwd: repo,
      clock: new Clock(() => FIXED_NOW),
      baseName: BASE_NAME,
    });
    const members = new Set([
      ...Object.keys(env),
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(env)).filter(
        (name) => name !== "constructor",
      ),
    ]);
    expect([...members].sort()).toEqual(["paths", "process", "vcs", "workspace"]);
    expect(env.workspace.at("s").slug).toBe("s");
    expect(env.process.clock.now()).toBe(FIXED_NOW);
    expect(Env.length).toBeLessThanOrEqual(1);
  });

  it("keeps the base source domain in one declared array", () => {
    expect([...BASE_SOURCES].length).toBeGreaterThan(1);
  });
});

/** The `src/**` scan: which non-test modules mention one identifier. */
class Scan {
  /** The scanned roots, as `src`-relative segments (the whole tree by default). */
  readonly #segments: readonly string[];

  /** Scan the whole `src/` tree, or the named segments of it — a file (`index.ts`) or a
   *  directory (`paths`) — so a pin states its face instead of implying every wave's. */
  constructor(segments: readonly string[] = ["."]) {
    this.#segments = segments;
  }

  /** The `src`-relative paths whose non-test text mentions `needle`. */
  filesUsing(needle: string): string[] {
    const root = path.join(ENGINE_ROOT, "src");
    const found: string[] = [];
    for (const segment of this.#segments) this.#walk(path.join(root, segment), root, needle, found);
    return found.sort();
  }

  /** Collect `needle`'s mentions under one root — a file reads itself, a directory walks. */
  #walk(target: string, root: string, needle: string, found: string[]): void {
    const stats = statSync(target);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(target, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name === "__tests__") continue;
        this.#walk(path.join(target, entry.name), root, needle, found);
      }
      return;
    }
    if (!target.endsWith(".ts")) return;
    if (readFileSync(target, "utf8").includes(needle)) found.push(path.relative(root, target));
  }
}
