// packages/cdd-engine/src/env/paths/__tests__/paths.test.ts
// The paths segment's pins: the basis resolves to the git top level or throws naming
// the directory it read; the doc roots are derived from the one declared constant; and
// the slug index answers a unique path, an `invalid` set for a doubled slug, or absence
// — never a silently chosen first file.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DOC_ROOT_KEYS, DOC_ROOT_SEGMENTS, docRootsOf } from "../doc-roots.ts";
import { type RepoPath, RepoRoot } from "../root.ts";
import { NodeDirectoryListing, SlugIndex } from "../slug-index.ts";

/** The temp roots this file made, removed after every case. */
const created: string[] = [];

/** A fresh temp directory. */
const tempDir = (prefix: string): string => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  created.push(directory);
  return directory;
};

/** A temp directory initialised as a git working tree. */
const tempRepo = (prefix: string): string => {
  const directory = tempDir(prefix);
  spawnSync("git", ["init", "-q"], { cwd: directory });
  return directory;
};

/** The `slug:`-line reader a document world would inject — enough for the path-face
 *  pin, and deliberately NOT a front-matter parser (the env plane parses none). */
const slugOf = (text: string): string | null => {
  for (const line of text.split("\n")) {
    if (!line.startsWith("slug:")) continue;
    return line.slice("slug:".length).trim();
  }
  return null;
};

/** Write one document under a doc root. */
const writeDoc = (repo: string, root: string, name: string, slug: string | null): void => {
  const directory = path.join(repo, root);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, name),
    slug === null ? "# no head\n" : `---\nslug: ${slug}\n---\n`,
    "utf8",
  );
};

afterEach(() => {
  for (const directory of created.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("the path basis", () => {
  it("resolves to the git top level of the working directory", () => {
    const repo = tempRepo("env-root-");
    const nested = path.join(repo, "a", "b");
    mkdirSync(nested, { recursive: true });
    expect(RepoRoot.of(nested).absolute).toBe(repo);
  });

  it("throws, naming the cwd, when the directory is not inside a git tree", () => {
    const outside = tempDir("env-nogit-");
    expect(() => RepoRoot.of(outside)).toThrow(outside);
  });
});

describe("the doc roots", () => {
  it("are the declared segments, derived from the one constant", () => {
    const repo = tempRepo("env-docs-");
    const docs = docRootsOf(RepoRoot.of(repo));
    expect(DOC_ROOT_KEYS.map((key) => docs.at(key))).toEqual(
      DOC_ROOT_KEYS.map((key) => DOC_ROOT_SEGMENTS[key]),
    );
  });

  it("contain their own documents and nothing else", () => {
    const repo = tempRepo("env-docs-scope-");
    const docs = docRootsOf(RepoRoot.of(repo));
    const inside = `${DOC_ROOT_SEGMENTS.plans}/p1.md` as RepoPath;
    expect(docs.contains(inside)).toBe(true);
    expect(docs.contains("docs/other/x.md" as RepoPath)).toBe(false);
  });
});

describe("the directory listing", () => {
  it("separates a directory from the files beside it — the observation set is files", () => {
    const repo = tempRepo("env-listing-");
    writeDoc(repo, DOC_ROOT_SEGMENTS.specs, "s1-design.md", "s1");
    mkdirSync(path.join(repo, DOC_ROOT_SEGMENTS.specs, "scratch"), { recursive: true });
    const listing = new NodeDirectoryListing(RepoRoot.of(repo));
    // `names` is the entry read (a document scan's candidate set), `files` the artifact read:
    // a directory is never an artifact, and the engine's own `scratch/` must not read as one.
    const specs = DOC_ROOT_SEGMENTS.specs as RepoPath;
    expect([...listing.names(specs)].sort()).toEqual(["s1-design.md", "scratch"]);
    expect(listing.files(specs)).toEqual(["s1-design.md"]);
    // A directory that does not exist holds nothing, on both reads.
    expect(listing.names(`${DOC_ROOT_SEGMENTS.specs}/gone` as never)).toEqual([]);
    expect(listing.files(`${DOC_ROOT_SEGMENTS.specs}/gone` as never)).toEqual([]);
  });
});

describe("the slug index", () => {
  it("answers the one path of a singly declared slug", () => {
    const repo = tempRepo("env-slug-");
    writeDoc(repo, DOC_ROOT_SEGMENTS.specs, "s1-design.md", "s1");
    const index = SlugIndex.scan(
      RepoRoot.of(repo),
      docRootsOf(RepoRoot.of(repo)),
      slugOf,
      new NodeDirectoryListing(RepoRoot.of(repo)),
    );
    expect(index.lookup("s1")).toEqual({
      kind: "unique",
      slug: "s1",
      rel: `${DOC_ROOT_SEGMENTS.specs}/s1-design.md`,
    });
  });

  it("reads a slug declared twice as `invalid`, in path order, not as a first pick", () => {
    const repo = tempRepo("env-slug-dup-");
    writeDoc(repo, DOC_ROOT_SEGMENTS.specs, "b-design.md", "dup");
    writeDoc(repo, DOC_ROOT_SEGMENTS.specs, "a-design.md", "dup");
    const index = SlugIndex.scan(
      RepoRoot.of(repo),
      docRootsOf(RepoRoot.of(repo)),
      slugOf,
      new NodeDirectoryListing(RepoRoot.of(repo)),
    );
    expect(index.lookup("dup")).toEqual({
      kind: "invalid",
      slug: "dup",
      rels: [`${DOC_ROOT_SEGMENTS.specs}/a-design.md`, `${DOC_ROOT_SEGMENTS.specs}/b-design.md`],
    });
  });

  it("answers absence for a slug no document declares", () => {
    const repo = tempRepo("env-slug-none-");
    const index = SlugIndex.scan(
      RepoRoot.of(repo),
      docRootsOf(RepoRoot.of(repo)),
      slugOf,
      new NodeDirectoryListing(RepoRoot.of(repo)),
    );
    expect(index.lookup("nope")).toEqual({ kind: "absent", slug: "nope" });
    expect(index.slugs()).toEqual([]);
  });
});
