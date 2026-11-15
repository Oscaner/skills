// packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts
// P36 T1/T2 — the artifact matrix's round and workspace domains (design spec §2.1 ·
// §2.2 · §2.3 · §2.9). The matrix answers two questions for every artifact kind: WHERE
// the name comes from (`identityFrom` + the row's own `render`) and WHICH identity it
// belongs to (`attribute`). This suite pins the ROUND rows (`draft` · `final` · `report`
// · `log` · `crash` · `evidence` · `rulings`) and the four WORKSPACE rows (`progress` ·
// `base` · `in-flight` · `brief`), plus the structural facts the matrix is worthless
// without:
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
import { SlugIndex } from "../../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../ledger.ts";
import {
  type ArtifactRead,
  ArtifactRegistry,
  type Attributed,
  DocDomain,
  type DocKind,
  type Identity,
  type IdentityDomain,
  type Kind,
  type MatrixEntry,
  RoundDomain,
  type RoundKind,
  renderRound,
  WorkspaceDomain,
  type WorkspaceKind,
} from "../round-artifacts.ts";
import { RoundNaming } from "../round-naming.ts";

/** The seven round kinds, in the matrix's own row order. */
const ROUND_KINDS: readonly RoundKind[] = [
  "draft",
  "final",
  "report",
  "log",
  "crash",
  "evidence",
  "rulings",
];

/** The four workspace kinds, in the matrix's own row order. */
const WORKSPACE_KINDS: readonly WorkspaceKind[] = ["progress", "base", "in-flight", "brief"];

/** The author / sealed columns each round row declares — the carrier pair is the
 *  engine's sealed set, the sidecar is the orchestrator's unsealed one. */
const ROUND_COLUMNS: Readonly<Record<RoundKind, { author: string; sealed: boolean }>> = {
  draft: { author: "engine", sealed: true },
  final: { author: "engine", sealed: true },
  report: { author: "engine", sealed: false },
  log: { author: "engine", sealed: false },
  crash: { author: "engine", sealed: false },
  evidence: { author: "engine", sealed: false },
  rulings: { author: "orchestrator", sealed: false },
};

/** The round identity a kind renders from — cycle 1, attempt 1 (the attempt segment is
 *  never rendered on the first attempt). */
const ROUND_IDENTITY: Identity = { domain: "round", line: "plan", op: "review", cycle: 1 };

/** The identity a cycle-less round renders from — the two optional coordinates absent. */
const ROUND_IDENTITY_NO_CYCLE: Identity = { domain: "round", line: "tasks-1", op: "implement" };

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

describe("the matrix — the round and workspace rows (spec §2.1)", () => {
  it("registers the seven round kinds and the four workspace kinds, in row order", () => {
    const { artifacts, cleanup } = fixture();
    try {
      expect(artifacts.entries().map((entry) => entry.kind)).toEqual([
        ...ROUND_KINDS,
        ...WORKSPACE_KINDS,
      ]);
      expect(artifacts.rows().map((row) => row.domain)).toEqual([
        ...ROUND_KINDS.map(() => "round"),
        ...WORKSPACE_KINDS.map(() => "workspace"),
      ]);
    } finally {
      cleanup();
    }
  });

  it("fills author / sealed / identityFrom / render on every registered row", () => {
    const { artifacts, cleanup } = fixture();
    try {
      for (const entry of artifacts.entries()) {
        const row = entry.row;
        const round = ROUND_COLUMNS[entry.kind as RoundKind];
        expect(row.author, entry.kind).toBe(round?.author ?? "engine");
        expect(row.sealed, entry.kind).toBe(round?.sealed ?? false);
        expect(row.identityFrom).toBe("rendered");
        if (row.identityFrom !== "rendered") continue;
        expect(row.misplaced).toBe("block");
        expect(typeof row.render).toBe("function");
      }
    } finally {
      cleanup();
    }
  });

  it("answers rowOf for every registered kind and null for a kind no domain declares", () => {
    const { artifacts, cleanup } = fixture();
    try {
      for (const kind of [...ROUND_KINDS, ...WORKSPACE_KINDS]) {
        expect(artifacts.rowOf(kind), kind).not.toBeNull();
      }
      // A domain that registers a PART of the closed set (the fixture injects one
      // row): a kind it never declared answers null — the matrix mints no row.
      const partial = new ArtifactRegistry([sealedDomain()]);
      expect(partial.rowOf("draft")).not.toBeNull();
      expect(partial.rowOf("rulings")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("declares the rulings row's identifier vocabulary and absence policy exactly once", () => {
    const { artifacts, cleanup } = fixture();
    try {
      const rulings = artifacts.rowOf("rulings");
      expect(rulings?.identifier).toEqual({ canonical: "finding", accepts: ["finding", "id"] });
      expect(rulings?.policy).toContain("absence is legal");
      // No other row declares an identifier or a policy — the single declaration site.
      const others = artifacts.rows().filter((row) => row.identifier !== undefined);
      expect(others).toHaveLength(1);
      expect(artifacts.rows().filter((row) => row.policy !== undefined)).toHaveLength(1);
    } finally {
      cleanup();
    }
  });
});

describe("the round trip over the round rows (spec §2.2 · §2.9 ① · T2)", () => {
  it("renders the rulings sidecar at the final's stem — the reviewed round's name", () => {
    const { artifacts, cleanup } = fixture();
    try {
      // Asserted from the IDENTITY (not by replacing the final's tail): both names
      // read the same four-segment stem, the final closing it with `.c<cycle>`.
      expect(artifacts.render(ROUND_IDENTITY, "rulings")).toBe("plan-review-1.c1.rulings.json");
      expect(artifacts.render(ROUND_IDENTITY, "final")).toBe("plan-review-1.c1.json");
      // The no-cycle form: the sidecar shares the final's stem with no cycle segment.
      expect(artifacts.render(ROUND_IDENTITY_NO_CYCLE, "rulings")).toBe(
        "tasks-1-implement.rulings.json",
      );
      expect(artifacts.render(ROUND_IDENTITY_NO_CYCLE, "final")).toBe("tasks-1-implement.json");
    } finally {
      cleanup();
    }
  });

  it("attributes every rendered round name back to its identity — both spellings, every kind", () => {
    const { artifacts, cleanup } = fixture();
    try {
      for (const kind of ROUND_KINDS) {
        const name = artifacts.render(ROUND_IDENTITY, kind);
        expect(artifacts.attribute(name), kind).toEqual({ identity: ROUND_IDENTITY, kind });
      }
      for (const kind of ROUND_KINDS) {
        const name = artifacts.render(ROUND_IDENTITY_NO_CYCLE, kind);
        const attributed = artifacts.attribute(name);
        // The cycle-less form gives `draft` and `final` ONE name, so its kind reads as
        // the draft (a cycle-less carrier is a draft, never a final) — the IDENTITY is
        // what the round trip pins there.
        expect(attributed?.identity, kind).toEqual(ROUND_IDENTITY_NO_CYCLE);
        expect(attributed?.kind, kind).toBe(kind === "final" ? "draft" : kind);
      }
    } finally {
      cleanup();
    }
  });

  it("attributes the tolerant spellings of one identity to the SAME (identity, kind)", () => {
    const { artifacts, cleanup } = fixture();
    try {
      const rendered = artifacts.render(ROUND_IDENTITY, "rulings");
      // the issue's writing convention: the `.c<cycle>` tag omitted
      expect(artifacts.attribute("plan-review-1.rulings.json")).toEqual({
        identity: ROUND_IDENTITY,
        kind: "rulings",
      });
      // an explicit first attempt — a spelling the renderer never mints
      expect(artifacts.attribute("plan-review-1-a1.json")).toEqual({
        identity: { ...ROUND_IDENTITY, attempt: 1 },
        kind: "draft",
      });
      expect(rendered).toBe("plan-review-1.c1.rulings.json");
    } finally {
      cleanup();
    }
  });

  it("answers unknown (null) for a name no round row renders", () => {
    const { artifacts, cleanup } = fixture();
    try {
      // a `.c<cycle>` tag that disagrees with the stem's own cycle belongs to no identity
      expect(artifacts.attribute("plan-review-1.c2.rulings.json")).toBeNull();
      // `implement` is the wave family's alone — a doc line never mints it
      expect(artifacts.attribute("plan-implement-1.json")).toBeNull();
      expect(artifacts.attribute("notes.json")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("renders the same name through the module entry and through the static delegate", () => {
    const { artifacts, cleanup } = fixture();
    try {
      for (const kind of ROUND_KINDS) {
        expect(renderRound(ROUND_IDENTITY, kind)).toBe(artifacts.render(ROUND_IDENTITY, kind));
      }
      // the static method reads the same body — one spelling, two entry forms
      expect(RoundNaming.renderName({ line: "plan", op: "review", cycle: 1 }, "final")).toBe(
        renderRound(ROUND_IDENTITY, "final"),
      );
    } finally {
      cleanup();
    }
  });

  it("locates and reads a round artifact inside the caller's workspace", () => {
    const { artifacts, workspace, cleanup } = fixture();
    try {
      expect(artifacts.locate(ROUND_IDENTITY, "rulings", workspace)).toBe(
        workspace.resolve("plan-review-1.c1.rulings.json"),
      );
      expect(artifacts.read(ROUND_IDENTITY, "rulings", workspace)).toEqual({ kind: "absent" });
      workspace.ensure();
      workspace.writeText("plan-review-1.c1.rulings.json", "{}\n");
      expect(artifacts.read(ROUND_IDENTITY, "rulings", workspace)).toEqual({
        kind: "ok",
        path: workspace.resolve("plan-review-1.c1.rulings.json"),
      });
    } finally {
      cleanup();
    }
  });

  it("refuses a foreign identity on the round rows instead of rendering a plausible name", () => {
    const { artifacts, workspace, cleanup } = fixture();
    try {
      const doc: Identity = { domain: "doc", slug: "p36", docType: "plan" };
      expect(() => artifacts.render(doc, "draft")).toThrow(/doc/);
      expect(() => artifacts.render(ROUND_IDENTITY, "progress")).toThrow(/workspace/);
      expect(() => artifacts.locate(doc, "draft", workspace)).toThrow(/doc/);
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
      expect(artifacts.attribute("notes.json")).toBeNull();
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

  it("never sweeps the orchestrator's sidecar — the matrix names the kind", () => {
    const name = "phase-spec-review-1.c1.rulings.json";
    const { dir, file } = dirWithFile(name);
    try {
      // The sidecar is the orchestrator's and is never sealed: the sweep asks the matrix
      // for the name's kind instead of holding a tail of its own, so the skip and the
      // `.rulings.json` spelling home can never drift apart.
      expect(CarrierSeal.sweep(dir, [], new ArtifactRegistry())).toEqual([]);
      expect(statSync(file).mode & 0o777).toBe(CarrierSeal.WRITABLE);
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

/** The kind guard, re-pointed (T2): once every domain registers its rows, no kind of
 *  the closed set is unregistered — the "kind with no row" arm is reachable only
 *  through a domain that registers a PART of the set, so the fixture domain carries it
 *  rather than a shape the production matrix can never produce. The cross-domain guard
 *  stays on the production matrix. */
describe("the matrix refuses a kind it holds no row for", () => {
  it("holds no row — and refuses to render — a kind the injected domains never declare", () => {
    const partial = new ArtifactRegistry([sealedDomain()]);
    const identity: Identity = { domain: "round", line: "tasks-1", op: "implement" };
    expect(partial.rowOf("rulings")).toBeNull();
    expect(() => partial.render(identity, "rulings" as Kind)).toThrow(/rulings/);
  });

  it("still refuses a CROSS-DOMAIN render on the production matrix", () => {
    const { artifacts, cleanup } = fixture();
    try {
      const identity: Identity = { domain: "workspace", tasks: null };
      expect(() => artifacts.render(identity, "draft")).toThrow(/workspace/);
      const round: Identity = { domain: "round", line: "plan", op: "review", cycle: 1 };
      expect(() => artifacts.render(round, "progress")).toThrow(/workspace/);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the doc domain (P36 T3) — declared identities, no rendered name
// ---------------------------------------------------------------------------

/** The four document kinds the doc domain declares. */
const DOC_KINDS: readonly DocKind[] = ["overall", "phase-spec", "single-spec", "plan"];

/** Write one front-matter document at its repo-relative path. */
const writeDoc = (repo: string, rel: string, fields: Readonly<Record<string, string>>): void => {
  const abs = path.join(repo, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  const head = ["---", ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`), "---"];
  writeFileSync(abs, `${head.join("\n")}\n## Body\n`, "utf8");
};

/** A hermetic repo carrying one spec + its paired plan, and the matrix bound to its
 *  index (the doc domain answers through the index the composition root builds). */
const docFixture = (): {
  repo: string;
  index: SlugIndex;
  artifacts: ArtifactRegistry;
  workspace: Workspace;
  cleanup: () => void;
} => {
  const repo = mkdtempSync(path.join(tmpdir(), "round-artifacts-doc-"));
  writeDoc(repo, "docs/kairos/specs/p36-design.md", {
    "doc-type": "phase-spec",
    slug: "p36",
  });
  writeDoc(repo, "docs/kairos/plans/p36.md", { "doc-type": "plan", slug: "p36" });
  const index = SlugIndex.build(repo);
  return {
    repo,
    index,
    artifacts: new ArtifactRegistry([
      new RoundDomain(),
      new WorkspaceDomain(),
      new DocDomain(index),
    ]),
    workspace: new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "p36"),
    cleanup: () => rmSync(repo, { recursive: true, force: true }),
  };
};

describe("the doc domain — declared rows, no name rule (spec §2.1 · §2.2 · §4.4)", () => {
  it("registers the four doc rows as declared, unsealed, human-authored", () => {
    const { artifacts, cleanup } = docFixture();
    try {
      for (const kind of DOC_KINDS) {
        const row = artifacts.rowOf(kind);
        expect(row, kind).toEqual({
          domain: "doc",
          author: "human",
          sealed: false,
          identityFrom: "declared",
        });
      }
    } finally {
      cleanup();
    }
  });

  it("renders no name for a declared row — the absence of a rule is the fact", () => {
    const { artifacts, cleanup } = docFixture();
    try {
      const identity: Identity = { domain: "doc", slug: "p36", docType: "plan" };
      expect(() => artifacts.render(identity, "plan")).toThrow(/no name rule/);
    } finally {
      cleanup();
    }
  });

  it("attributes an indexed path to the document's DECLARED identity", () => {
    const { artifacts, cleanup } = docFixture();
    try {
      expect(artifacts.attribute("docs/kairos/specs/p36-design.md")).toEqual({
        identity: { domain: "doc", slug: "p36", docType: "phase-spec" },
        kind: "phase-spec",
      });
      expect(artifacts.attribute("docs/kairos/plans/p36.md")).toEqual({
        identity: { domain: "doc", slug: "p36", docType: "plan" },
        kind: "plan",
      });
      // no filename derivation: a name the index never scanned is not a document
      expect(artifacts.attribute("docs/kairos/specs/made-up.md")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("reads the sole document at its declared home — the index entry's `rel`", () => {
    const { artifacts, workspace, cleanup } = docFixture();
    try {
      const plan: Identity = { domain: "doc", slug: "p36", docType: "plan" };
      // One basis: the declared domain answers the repo-root-relative home, so a doc
      // read and a doc locate never name one document two ways (the rendered domains
      // answer the absolute form their `base` resolves).
      expect(artifacts.locate(plan, "plan", workspace)).toBe("docs/kairos/plans/p36.md");
      expect(artifacts.read(plan, "plan", workspace)).toEqual({
        kind: "ok",
        path: "docs/kairos/plans/p36.md",
      });
    } finally {
      cleanup();
    }
  });

  it("reads a duplicated identity as invalid(found) while attribute still answers the identity", () => {
    const { repo, workspace, cleanup } = docFixture();
    try {
      expect(SlugIndex.isLegalSlug("p36")).toBe(true);
      writeDoc(repo, "docs/kairos/specs/p36-again.md", {
        "doc-type": "phase-spec",
        slug: "p36",
      });
      const index = SlugIndex.build(repo);
      const artifacts = new ArtifactRegistry([
        new RoundDomain(),
        new WorkspaceDomain(),
        new DocDomain(index),
      ]);
      const identity: Identity = { domain: "doc", slug: "p36", docType: "phase-spec" };
      const found = ["docs/kairos/specs/p36-again.md", "docs/kairos/specs/p36-design.md"];
      const read = artifacts.read(identity, "phase-spec", workspace);
      expect(read.kind).toBe("invalid");
      expect(read.kind === "invalid" ? read.found : []).toEqual(found);
      expect(read.kind === "invalid" ? read.reason : "").toBe("duplicate-identity");
      // the name itself is unambiguous — the ambiguity belongs to the identity side
      expect(artifacts.attribute("docs/kairos/specs/p36-design.md")).toEqual({
        identity,
        kind: "phase-spec",
      });
      // a set of two has no single path
      expect(artifacts.locate(identity, "phase-spec", workspace)).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("refuses a foreign identity or a kind the document does not declare", () => {
    const { artifacts, workspace, cleanup } = docFixture();
    try {
      const round: Identity = { domain: "round", line: "plan", op: "review", cycle: 1 };
      const plan: Identity = { domain: "doc", slug: "p36", docType: "plan" };
      expect(() => artifacts.read(round, "plan", workspace)).toThrow(/round/);
      expect(() => artifacts.read(plan, "phase-spec", workspace)).toThrow(/phase-spec/);
    } finally {
      cleanup();
    }
  });
});
