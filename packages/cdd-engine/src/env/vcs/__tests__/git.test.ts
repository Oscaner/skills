// packages/cdd-engine/src/env/vcs/__tests__/git.test.ts
// The vcs segment's pins:
//   · the three git reads — the top level, the status, the commits — each answers on a
//     real repository, and the status read is pinned on both a clean and a dirty tree;
//   · every read is fail-open: outside a repository the top level is null and the status
//     counts dirty, never a throw;
//   · the plan source answers a plan's BYTES by the identity its document declares, an
//     ambiguous set when two documents declare it, and absence otherwise — never a
//     derived file name.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DOC_ROOT_SEGMENTS, docRootsOf } from "../../paths/doc-roots.ts";
import { type RepoPath, RepoRoot } from "../../paths/root.ts";
import { SlugIndex } from "../../paths/slug-index.ts";
import { GitClient } from "../git.ts";
import { planSourceOf } from "../plan-source.ts";

/** The temp roots this file made, removed after every case. */
const created: string[] = [];

/** Run git in one directory, failing loudly when the fixture setup broke. */
const git = (cwd: string, args: readonly string[]): void => {
  const result = spawnSync(
    "git",
    ["-c", "user.email=pin@example.com", "-c", "user.name=pin", ...args],
    { cwd, encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
};

/** A fresh temp directory. */
const tempDir = (prefix: string): string => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  created.push(directory);
  return directory;
};

/** A temp directory initialised as a git working tree. */
const tempRepo = (prefix: string): string => {
  const directory = tempDir(prefix);
  git(directory, ["init", "-q"]);
  return directory;
};

/** One committed file — the fixture that makes a repository non-empty. */
const seed = (repo: string, name: string, text: string): void => {
  writeFileSync(path.join(repo, name), text, "utf8");
  git(repo, ["add", name]);
  git(repo, ["commit", "-q", "-m", `add ${name}`]);
};

/** Write one plan document (a `slug:`-declaring head, enough for the path index). */
const writePlan = (repo: string, name: string, slug: string): void => {
  const directory = path.join(repo, DOC_ROOT_SEGMENTS.plans);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, name), `---\nslug: ${slug}\n---\n\n# plan\n`, "utf8");
};

/** The declared-slug reader the index is scanned with. */
const slugOf = (text: string): string | null => {
  for (const line of text.split("\n")) {
    if (line.startsWith("slug:")) return line.slice("slug:".length).trim();
  }
  return null;
};

/** The plan source of one repository, over its own scanned index. */
const plansOf = (repo: string) => {
  const root = RepoRoot.of(repo);
  const docs = docRootsOf(root);
  return planSourceOf({ root, docs, index: SlugIndex.scan(root, docs, slugOf) });
};

afterEach(() => {
  for (const directory of created.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("the git reads", () => {
  it("answers the top level of a repository, and null outside one", async () => {
    const repo = tempRepo("vcs-top-");
    mkdirSync(path.join(repo, "a", "b"), { recursive: true });
    expect(await new GitClient(repo).topLevel(path.join(repo, "a", "b"))).toBe(repo);
    expect(await new GitClient(tempDir("vcs-nogit-")).topLevel()).toBeNull();
  });

  it("reads the status of a clean tree and of a dirty one", async () => {
    const repo = tempRepo("vcs-status-");
    seed(repo, "a.txt", "a\n");
    expect(await new GitClient(repo).isClean()).toBe(true);
    writeFileSync(path.join(repo, "b.txt"), "b\n", "utf8");
    expect(await new GitClient(repo).isClean()).toBe(false);
    expect(await new GitClient(tempDir("vcs-nogit-status-")).isClean()).toBe(false);
  });

  it("answers the commits a range added, and the paths it touched", async () => {
    const repo = tempRepo("vcs-commits-");
    seed(repo, "a.txt", "a\n");
    const client = new GitClient(repo);
    const base = await client.head();
    expect(base).not.toBeNull();
    seed(repo, "b.txt", "b\n");
    const commits = await client.commitsSince(base);
    expect(commits.map((commit) => commit.subject)).toEqual(["add b.txt"]);
    expect(await client.pathsSince(base)).toEqual(["b.txt"]);
    // An absent base is "cannot tell", never "nothing changed", and a readable range
    // with no commit after the head is the empty list.
    expect(await client.pathsSince(null)).toBeNull();
    expect(await client.pathsSince(await client.head())).toEqual([]);
  });
});

describe("the plan source", () => {
  it("answers a plan's bytes by the slug its document declares", () => {
    const repo = tempRepo("vcs-plan-");
    writePlan(repo, "unknown-name.md", "p1");
    const read = plansOf(repo).readFor("p1");
    expect(read.kind).toBe("text");
    if (read.kind !== "text") throw new Error("unreachable");
    expect(read.target).toBe(`${DOC_ROOT_SEGMENTS.plans}/unknown-name.md` as RepoPath);
    expect(read.value).toContain("slug: p1");
  });

  it("answers the found set when two plans declare the same slug, and absence otherwise", () => {
    const repo = tempRepo("vcs-plan-dup-");
    writePlan(repo, "a.md", "p2");
    writePlan(repo, "b.md", "p2");
    const ambiguous = plansOf(repo).readFor("p2");
    expect(ambiguous.kind).toBe("ambiguous");
    if (ambiguous.kind !== "ambiguous") throw new Error("unreachable");
    expect(ambiguous.found).toEqual([
      `${DOC_ROOT_SEGMENTS.plans}/a.md`,
      `${DOC_ROOT_SEGMENTS.plans}/b.md`,
    ]);
    expect(plansOf(repo).readFor("nobody")).toEqual({ kind: "absent", slug: "nobody" });
  });

  it("reads an argv coordinate verbatim, and declares a read failure at that coordinate", () => {
    const repo = tempRepo("vcs-plan-path-");
    seed(repo, "notes.md", "hello\n");
    const source = plansOf(repo);
    expect(source.readPath("notes.md" as RepoPath)).toEqual({
      kind: "text",
      target: "notes.md",
      value: "hello\n",
    });
    expect(source.readPath("ghost.md" as RepoPath)).toEqual({
      kind: "read-failure",
      target: "ghost.md",
    });
  });
});
