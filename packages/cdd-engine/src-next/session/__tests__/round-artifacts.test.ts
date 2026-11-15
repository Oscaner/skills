// packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts
// P36 T1 — the artifact matrix's workspace domain (design spec §2.1 · §2.2 · §2.3 ·
// §2.9). The matrix answers two questions for every artifact kind: WHERE the name comes
// from (`identityFrom` + the row's own `render`) and WHICH identity it belongs to
// (`attribute`). This suite pins the four WORKSPACE rows this wave registers
// (`progress` · `base` · `in-flight` · `brief`) and the structural facts the matrix is
// worthless without:
//
//   · the round trip — `attribute(render(identity, kind))` answers the same identity
//     and kind, per row, so the two ports cannot drift apart; the rendered names are
//     byte-equal to today's literals (the conservation boundary: a naming migration
//     must not rename anything);
//   · the coordinate guard — an identity a row does not carry (a null `tasks` for the
//     brief, a task group for the three literals) is refused, never rendered into a
//     plausible-looking wrong name;
//   · one home — the workspace name literals live in `session/round-artifacts.ts`
//     alone, and the registry has exactly ONE construction expression in the
//     production source, so every read face must be handed the same instance instead
//     of minting its own.
//
// The scan reads the engine's own source with comments stripped (the shared stripper
// in `__tests__/support/strip-comments.ts`, the same posture as the other source
// guards: a docstring naming a file is prose, a literal in code is a real name).
//
// Zero module-level bare functions — every helper is an arrow const.

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../__tests__/support/strip-comments.ts";
import { CarrierSeal } from "../../infra/carrier-seal.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { PlanSource } from "../../infra/plan-source.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../ledger.ts";
import {
  type ArtifactRead,
  ArtifactRegistry,
  type Attributed,
  type Identity,
  type IdentityDomain,
  type Kind,
  type MatrixEntry,
  type WorkspaceKind,
} from "../round-artifacts.ts";

/** The four workspace kinds this wave registers, in the matrix's own row order. */
const WORKSPACE_KINDS: readonly WorkspaceKind[] = ["progress", "base", "in-flight", "brief"];

/** The name each workspace row renders TODAY — the conservation boundary: the matrix
 *  is a move of the spelling, never a rename. */
const RENDERED: Readonly<Record<WorkspaceKind, string>> = {
  progress: "progress.json",
  base: "base.json",
  "in-flight": "in-flight.json",
  brief: "tasks-3-brief.md",
};

/** The identity each workspace row renders from — the three coordinate-less literals
 *  take `tasks: null`, the brief carries its group. */
const IDENTITY_OF: Readonly<Record<WorkspaceKind, Identity>> = {
  progress: { domain: "workspace", tasks: null },
  base: { domain: "workspace", tasks: null },
  "in-flight": { domain: "workspace", tasks: null },
  brief: { domain: "workspace", tasks: "3" },
};

/** The sealed fixture row's name — a carrier shape no matrix row registers. */
const SEALED_CARRIER = "sealed-carrier.json";

/** `src-next/` — every path below resolves against the engine source root. */
const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** A hermetic matrix fixture — one workspace under a temp repo root. */
const fixture = (
  slug = "test-slug",
): {
  root: WorkspaceRoot;
  workspace: Workspace;
  artifacts: ArtifactRegistry;
  cleanup: () => void;
} => {
  const repo = mkdtempSync(path.join(tmpdir(), "round-artifacts-"));
  const root = new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session");
  return {
    root,
    workspace: new Workspace(root, slug),
    artifacts: new ArtifactRegistry(),
    cleanup: () => rmSync(repo, { recursive: true, force: true }),
  };
};

/** A fixture identity domain — ONE row marked `sealed: true`, the column the carrier
 *  sweep must read (every workspace row is `false`, so the column's true arm is
 *  reachable only through an injected domain). */
const sealedDomain = (): IdentityDomain => ({
  domain: "round",
  kinds: (): readonly Kind[] => ["draft"],
  entries: (): readonly MatrixEntry[] => [
    {
      kind: "draft",
      row: { domain: "round", author: "engine", sealed: true, identityFrom: "declared" },
    },
  ],
  attribute: (name: string): Attributed | null =>
    name === SEALED_CARRIER
      ? { identity: { domain: "round", line: "tasks-1", op: "implement" }, kind: "draft" }
      : null,
  locate: (): string | null => null,
  read: (): ArtifactRead => ({ kind: "absent" }),
});

/** Walk the production tree collecting `.ts` files, `__tests__` excluded — the fixture
 *  plane is never a production construction point or a name home. */
const collectProductionTs = (dir: string, out: string[]): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      collectProductionTs(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".ts")) {
      out.push(path.join(dir, entry.name));
    }
  }
};

/** Every producing file of one source token over the production face. */
const hitsOf = (token: string): string[] => {
  const files: string[] = [];
  collectProductionTs(SRC_ROOT, files);
  return files
    .filter((file) => stripComments(readFileSync(file, "utf8")).includes(token))
    .map((file) => path.relative(SRC_ROOT, file));
};

/** A temp directory holding one file of the given bytes and mode. */
const dirWithFile = (name: string, mode = 0o644): { dir: string; file: string } => {
  const dir = mkdtempSync(path.join(tmpdir(), "round-artifacts-dir-"));
  const file = path.join(dir, name);
  writeFileSync(file, "{}\n", "utf8");
  chmodSync(file, mode);
  return { dir, file };
};

describe("the matrix — the four workspace rows (spec §2.1)", () => {
  it("registers exactly the four workspace kinds, in row order", () => {
    const { artifacts, cleanup } = fixture();
    try {
      expect(artifacts.entries().map((entry) => entry.kind)).toEqual([...WORKSPACE_KINDS]);
      expect(artifacts.rows().map((row) => row.domain)).toEqual([
        "workspace",
        "workspace",
        "workspace",
        "workspace",
      ]);
    } finally {
      cleanup();
    }
  });

  it("fills author / sealed / identityFrom / render on every registered row", () => {
    const { artifacts, cleanup } = fixture();
    try {
      for (const row of artifacts.rows()) {
        expect(row.author).toBe("engine");
        expect(row.sealed).toBe(false);
        expect(row.identityFrom).toBe("rendered");
        if (row.identityFrom !== "rendered") continue;
        expect(row.misplaced).toBe("block");
        expect(typeof row.render).toBe("function");
      }
    } finally {
      cleanup();
    }
  });

  it("answers rowOf for the registered kinds and null for an unregistered one", () => {
    const { artifacts, cleanup } = fixture();
    try {
      for (const kind of WORKSPACE_KINDS) expect(artifacts.rowOf(kind)).not.toBeNull();
      // The round domain arrives with its own task — an unregistered kind is not a row.
      expect(artifacts.rowOf("draft")).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe("the round trip — render ∘ attribute = id (spec §2.2 · §2.9 ①)", () => {
  it("renders today's byte-identical names (the conservation boundary)", () => {
    const { artifacts, cleanup } = fixture();
    try {
      for (const kind of WORKSPACE_KINDS) {
        expect(artifacts.render(IDENTITY_OF[kind], kind)).toBe(RENDERED[kind]);
      }
    } finally {
      cleanup();
    }
  });

  it("attributes every rendered name back to the same identity and kind", () => {
    const { artifacts, cleanup } = fixture();
    try {
      for (const kind of WORKSPACE_KINDS) {
        const name = artifacts.render(IDENTITY_OF[kind], kind);
        expect(artifacts.attribute(name)).toEqual({ identity: IDENTITY_OF[kind], kind });
      }
    } finally {
      cleanup();
    }
  });

  it("keeps the brief's tasks coordinate distinct across groups", () => {
    const { artifacts, cleanup } = fixture();
    try {
      const grouped: Identity = { domain: "workspace", tasks: "4,5" };
      expect(artifacts.render(grouped, "brief")).toBe("tasks-4,5-brief.md");
      expect(artifacts.attribute("tasks-4,5-brief.md")).toEqual({
        identity: grouped,
        kind: "brief",
      });
    } finally {
      cleanup();
    }
  });

  it("answers unknown (null) for a name no row renders", () => {
    const { artifacts, cleanup } = fixture();
    try {
      expect(artifacts.attribute("plan-review-1.c1.rulings.json")).toBeNull();
      expect(artifacts.attribute("spec-1.json")).toBeNull();
      // The brief's empty coordinate is not a name: nothing renders `tasks--brief.md`.
      expect(artifacts.attribute("tasks--brief.md")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("renders the same name through the module-level entry as through the instance", () => {
    // One row render, two entry forms: the read faces that hold no instance must not
    // be a second spelling, so the pair is pinned rather than assumed.
    const { artifacts, cleanup } = fixture();
    try {
      for (const kind of WORKSPACE_KINDS) {
        const tasks = IDENTITY_OF[kind].domain === "workspace" ? IDENTITY_OF[kind].tasks : null;
        expect(ArtifactRegistry.nameOf(kind, tasks)).toBe(
          artifacts.render(IDENTITY_OF[kind], kind),
        );
      }
    } finally {
      cleanup();
    }
  });
});

describe("the matrix refuses an identity the row does not carry (spec §2.1)", () => {
  it("refuses a brief with no tasks coordinate on both entry forms", () => {
    const { artifacts, cleanup } = fixture();
    try {
      const nameless: Identity = { domain: "workspace", tasks: null };
      expect(() => artifacts.render(nameless, "brief")).toThrow(/tasks coordinate/);
      expect(() => ArtifactRegistry.nameOf("brief", null)).toThrow(/tasks coordinate/);
      expect(() => ArtifactRegistry.nameOf("brief", "")).toThrow(/tasks coordinate/);
    } finally {
      cleanup();
    }
  });

  it("refuses a tasks coordinate the coordinate-less literals do not carry", () => {
    const { artifacts, cleanup } = fixture();
    try {
      const grouped: Identity = { domain: "workspace", tasks: "3" };
      for (const kind of ["progress", "base", "in-flight"] as const) {
        expect(() => artifacts.render(grouped, kind)).toThrow(/no tasks coordinate/);
        expect(() => ArtifactRegistry.nameOf(kind, "3")).toThrow(/no tasks coordinate/);
      }
    } finally {
      cleanup();
    }
  });
});

describe("the read face — locate + read (spec §2.2 · §2.3 · §4.5)", () => {
  it("resolves a rendered row inside the workspace the caller observes", () => {
    const { artifacts, workspace, cleanup } = fixture();
    try {
      expect(artifacts.locate(IDENTITY_OF.progress, "progress", workspace)).toBe(
        workspace.resolve("progress.json"),
      );
      expect(artifacts.read(IDENTITY_OF.progress, "progress", workspace)).toEqual({
        kind: "absent",
      });
    } finally {
      cleanup();
    }
  });

  it("reads a written row as ok with its resolved path", () => {
    const { artifacts, workspace, cleanup } = fixture();
    try {
      workspace.ensure();
      mkdirSync(workspace.path, { recursive: true });
      workspace.writeText(artifacts.render(IDENTITY_OF.base, "base"), "{}\n");
      const read = artifacts.read(IDENTITY_OF.base, "base", workspace);
      expect(read).toEqual({ kind: "ok", path: workspace.resolve("base.json") });
      expect(existsSync(workspace.resolve("base.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("answers invalid — never absent — for a path that exists but is not a file", () => {
    const { artifacts, workspace, cleanup } = fixture();
    try {
      workspace.ensure();
      mkdirSync(path.join(workspace.path, "progress.json"), { recursive: true });
      const read = artifacts.read(IDENTITY_OF.progress, "progress", workspace);
      expect(read).toEqual({
        kind: "invalid",
        path: workspace.resolve("progress.json"),
        reason: "not a regular file",
      });
    } finally {
      cleanup();
    }
  });

  // A root process reads through any mode bit, so the unreadable arm is pinned only
  // where the fixture can actually make the file unreadable.
  it.skipIf(typeof process.getuid === "function" && process.getuid() === 0)(
    "answers invalid(unreadable) for a file IO cannot read — never absent (spec §4.5)",
    () => {
      const { artifacts, workspace, root, cleanup } = fixture();
      try {
        workspace.ensure();
        mkdirSync(workspace.path, { recursive: true });
        const file = path.join(workspace.path, "progress.json");
        writeFileSync(file, "{}\n", "utf8");
        chmodSync(file, 0o000);
        const read = artifacts.read(IDENTITY_OF.progress, "progress", workspace);
        expect(read).toEqual({
          kind: "invalid",
          path: workspace.resolve("progress.json"),
          reason: "unreadable",
        });
        expect(existsSync(path.join(root.path, "test-slug", "progress.json"))).toBe(true);
      } finally {
        cleanup();
      }
    },
  );

  it("refuses a foreign identity / an unregistered kind instead of reading an absence", () => {
    const { artifacts, workspace, cleanup } = fixture();
    try {
      const doc: Identity = { domain: "doc", slug: "p36", docType: "plan" };
      expect(() => artifacts.locate(doc, "progress", workspace)).toThrow(/doc/);
      expect(() => artifacts.locate(IDENTITY_OF.progress, "draft", workspace)).toThrow(/draft/);
      expect(() => artifacts.read(IDENTITY_OF.progress, "draft", workspace)).toThrow(/draft/);
    } finally {
      cleanup();
    }
  });

  it("resolves one identity to each node's own directory when two workspaces share the matrix", () => {
    // The board renders a node and its overall through ONE matrix: a bound-at-
    // construction workspace would resolve the second node's names against the first
    // node's directory — a legal name owned by another coordinate.
    const { root, artifacts, cleanup } = fixture();
    try {
      const alpha = new Workspace(root, "alpha");
      const beta = new Workspace(root, "beta");
      expect(artifacts.locate(IDENTITY_OF.progress, "progress", alpha)).toBe(
        alpha.resolve("progress.json"),
      );
      expect(artifacts.locate(IDENTITY_OF.progress, "progress", beta)).toBe(
        beta.resolve("progress.json"),
      );
      expect(alpha.resolve("progress.json")).not.toBe(beta.resolve("progress.json"));
    } finally {
      cleanup();
    }
  });

  it("lets two node ledgers read their own progress through one shared matrix", () => {
    const { root, artifacts, cleanup } = fixture();
    try {
      const alpha = new Workspace(root, "alpha");
      const beta = new Workspace(root, "beta");
      const plan = new PlanSource(root.basis);
      const ledgerAlpha = new Ledger(alpha, new ConfigLoader(), plan, artifacts);
      const ledgerBeta = new Ledger(beta, new ConfigLoader(), plan, artifacts);
      ledgerAlpha.writeProgress({ ...ledgerAlpha.emptyProgress(), plan: "alpha.md" });
      ledgerBeta.writeProgress({ ...ledgerBeta.emptyProgress(), plan: "beta.md" });
      expect(ledgerAlpha.readProgress()?.plan).toBe("alpha.md");
      expect(ledgerBeta.readProgress()?.plan).toBe("beta.md");
    } finally {
      cleanup();
    }
  });
});

describe("one home, one instance (spec §2.1 · §2.9 ⑤)", () => {
  it("spells the workspace name literals in the matrix alone", () => {
    // A hit elsewhere means a read face kept (or re-minted) its own spelling: the
    // matrix would then stand beside a second name home again.
    const tokens = ['"progress.json"', '"base.json"', '"in-flight.json"', "-brief.md"];
    for (const token of tokens) {
      expect(hitsOf(token)).toEqual(["session/round-artifacts.ts"]);
    }
  });

  it("constructs the registry at exactly ONE production site", () => {
    // Zero hits: the matrix is never injected. Two hits: a face minted its own
    // instance, and the "same instance everywhere" invariant is already broken.
    expect(hitsOf("new ArtifactRegistry(")).toEqual(["face/cli.ts"]);
  });

  it("reads the `sealed` column out of the matrix, not only the naming predicate", () => {
    const { dir, file } = dirWithFile(SEALED_CARRIER);
    try {
      // No row attributes the name and the naming predicate says "not a carrier": the
      // workspace-only matrix recovers nothing.
      expect(CarrierSeal.sweep(dir, [])).toEqual([]);
      expect(CarrierSeal.sweep(dir, [], new ArtifactRegistry())).toEqual([]);
      // The injected row marks the SAME name sealed — the sweep now sees a writable
      // carrier, which is only visible through `rowOf(attributed.kind).sealed`.
      expect(CarrierSeal.sweep(dir, [], new ArtifactRegistry([sealedDomain()]))).toEqual([
        SEALED_CARRIER,
      ]);
      expect(statSync(file).mode & 0o777).toBe(CarrierSeal.SEALED);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("judges an orphan carrier the same way with and without the workspace matrix", () => {
    const name = "tasks-1-review-2.c2.json";
    const bare = dirWithFile(name);
    const wired = dirWithFile(name);
    try {
      expect(CarrierSeal.sweep(bare.dir, [])).toEqual([name]);
      expect(CarrierSeal.sweep(wired.dir, [], new ArtifactRegistry())).toEqual([name]);
    } finally {
      rmSync(bare.dir, { recursive: true, force: true });
      rmSync(wired.dir, { recursive: true, force: true });
    }
  });
});

/** The literal token list stays honest: the matrix answers renders for exactly the
 *  kinds the rows declare (a kind outside the registered set throws rather than
 *  returning a made-up name). */
describe("the matrix refuses a kind it holds no row for", () => {
  it("throws on rendering an unregistered kind", () => {
    const { artifacts, cleanup } = fixture();
    try {
      const identity: Identity = { domain: "workspace", tasks: null };
      expect(() => artifacts.render(identity, "rulings" as Kind)).toThrow(/rulings/);
    } finally {
      cleanup();
    }
  });
});
