// packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts
// P36 T1 — the artifact matrix's workspace domain (design spec §2.1 · §2.2 · §2.9).
// The matrix answers two questions for every artifact kind: WHERE the name comes from
// (`identityFrom` + the row's own `render`) and WHICH identity it belongs to
// (`attribute`). This suite pins the four WORKSPACE rows this wave registers
// (`progress` · `base` · `in-flight` · `brief`) and the two structural facts the
// matrix is worthless without:
//
//   · the round trip — `attribute(render(identity, kind))` answers the same identity
//     and kind, per row, so the two ports cannot drift apart; the rendered names are
//     byte-equal to today's literals (the conservation boundary: a naming migration
//     must not rename anything);
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

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../__tests__/support/strip-comments.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { PlanSource } from "../../infra/plan-source.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../ledger.ts";
import { NextStepRouter } from "../next.ts";
import {
  ArtifactRegistry,
  type Identity,
  type Kind,
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

/** `src-next/` — every path below resolves against the engine source root. */
const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** A hermetic matrix fixture — one workspace under a temp repo root. */
const fixture = (): {
  workspace: Workspace;
  artifacts: ArtifactRegistry;
  cleanup: () => void;
} => {
  const repo = mkdtempSync(path.join(tmpdir(), "round-artifacts-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "test-slug",
  );
  return {
    workspace,
    artifacts: new ArtifactRegistry(workspace),
    cleanup: () => rmSync(repo, { recursive: true, force: true }),
  };
};

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

describe("the matrix — the four workspace rows (spec §2.1)", () => {
  it("registers exactly the four workspace kinds, in row order", () => {
    const { artifacts, cleanup } = fixture();
    try {
      expect(artifacts.rows().map((row) => row.domain)).toEqual([
        "workspace",
        "workspace",
        "workspace",
        "workspace",
      ]);
      expect(
        artifacts.rows().map((row) => (row.identityFrom === "rendered" ? row : null) !== null),
      ).toEqual([true, true, true, true]);
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
    } finally {
      cleanup();
    }
  });
});

describe("the read face — locate + read (spec §2.2)", () => {
  it("locates a rendered row against the workspace and reads absence before any write", () => {
    const { artifacts, workspace, cleanup } = fixture();
    try {
      expect(artifacts.locate(IDENTITY_OF.progress, "progress")).toBe(
        workspace.resolve("progress.json"),
      );
      expect(artifacts.read(IDENTITY_OF.progress, "progress")).toEqual({ kind: "absent" });
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
      const read = artifacts.read(IDENTITY_OF.base, "base");
      expect(read).toEqual({ kind: "ok", path: workspace.resolve("base.json") });
      expect(existsSync(workspace.resolve("base.json"))).toBe(true);
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

  it("hands the ledger's and the router's faces the same injected instance", () => {
    const { artifacts, workspace, cleanup } = fixture();
    try {
      const ledger = new Ledger(
        workspace,
        new ConfigLoader(),
        new PlanSource(workspace.root.basis),
        artifacts,
      );
      expect(ledger.artifacts()).toBe(artifacts);
      expect(new NextStepRouter(artifacts).artifacts()).toBe(artifacts);
    } finally {
      cleanup();
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
