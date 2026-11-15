// packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts
// P31 T2 — the rulings sidecar (design spec §2.1/§2.6). The strict schema is the
// dispatch gate: every bad shape gets its OWN case here, because each one has to stop
// the fix round BEFORE the child is spawned — a ruling that was written but refused
// must never read as one the round silently ignored.
//
// The sidecar's PATH is no longer minted here: it is the artifact matrix's `rulings`
// row rendered from the reviewed round's identity (P36 T2). This suite takes the
// rendered path from its caller, and pins that the class holds no naming rule of its own
// (the sidecar tail is spelled in the matrix row alone) and that the strict gate still
// judges the `carrier` key against the CARRIER's basename — the carrier's fact is never
// re-derived from the sidecar's name.

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { stripComments } from "../../__tests__/support/strip-comments.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { CarrierRulings } from "../carrier-rulings.ts";
import { ArtifactRegistry, type Identity } from "../round-artifacts.ts";

/** The carrier the sidecar sits beside — its basename is the `carrier` key's value. */
const CARRIER = "phase-spec-review-1.c2.json";

/** The carrier's own finding-id set — the injected fact a ruling must name. */
const FINDING_IDS: ReadonlySet<string> = new Set(["F1", "F4"]);

/** A legal sidecar body, over which each bad shape is written. */
const LEGAL = {
  carrier: CARRIER,
  rulings: [
    { finding: "F4", ruling: "REJECTED as stated", at: "2026-11-09T00:00:00Z", by: "orchestrator" },
  ],
};

/** One hermetic carrier directory per case. */
const dirs: string[] = [];

/** The sidecar's NAME for this fixture's carrier — the matrix's `final` stem with the
 *  `.rulings` tail (`phase-spec-review-1.c2.rulings.json`). A fixture may spell the
 *  literal; the production face may not. */
const SIDECAR_NAME = CARRIER.replace(/\.json$/, ".rulings.json");

/** Create a carrier directory and return the carrier's absolute path (the file itself
 *  is never written: only the sidecar matters to this judgment). */
const carrierDir = (): { carrier: string; sidecar: string; cleanup: () => void } => {
  const dir = mkdtempSync(path.join(tmpdir(), "carrier-rulings-"));
  dirs.push(dir);
  const carrier = path.join(dir, CARRIER);
  return { carrier, sidecar: path.join(dir, SIDECAR_NAME), cleanup: () => {} };
};

/** Judge one sidecar body (a string is written verbatim, anything else as JSON). */
const verdictOf = (body: unknown): ReturnType<typeof CarrierRulings.verdict> => {
  const { carrier, sidecar } = carrierDir();
  writeFileSync(sidecar, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return CarrierRulings.verdict(sidecar, carrier, FINDING_IDS);
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("CarrierRulings — no naming rule of its own (P36 T2)", () => {
  /** `src-next/session` — the sidecar class's own plane. */
  const SESSION_ROOT = fileURLToPath(new URL("../../session/", import.meta.url));

  it("holds no sidecar-tail spelling — the matrix row renders the name", () => {
    const files = readdirSync(SESSION_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => entry.name);
    const hits = files.filter((name) =>
      stripComments(readFileSync(path.join(SESSION_ROOT, name), "utf8")).includes(".rulings.json"),
    );
    // The matrix row is the ONE home. `session/next.ts` still spells the readback rule
    // sentence; closing that set to the matrix row alone is the later task's tightening
    // (the readback line becomes a rendered VALUE), so this pin holds the class itself
    // out of the set without pre-empting it.
    expect(hits).not.toContain("carrier-rulings.ts");
    expect(hits).toContain("round-artifacts.ts");
  });

  it("takes the sidecar's rendered path from its caller, not from the carrier's tail", () => {
    // The two carriers of ONE round (draft, final) render ONE sidecar — that is the
    // matrix's fact, so the same rendered path judges both.
    const { carrier, sidecar } = carrierDir();
    writeFileSync(sidecar, JSON.stringify({ ...LEGAL, carrier: path.basename(carrier) }), "utf8");
    expect(CarrierRulings.verdict(sidecar, carrier, FINDING_IDS).kind).toBe("ok");
  });
});

describe("CarrierRulings — the three-state read", () => {
  it("reads absent when no sidecar exists", () => {
    const { carrier, sidecar } = carrierDir();
    expect(CarrierRulings.verdict(sidecar, carrier, FINDING_IDS)).toEqual({ kind: "absent" });
    expect(CarrierRulings.read(sidecar, carrier)).toBeNull();
  });

  it("reads ok on a schema-conforming sidecar, and hands the rulings back", () => {
    const verdict = verdictOf(LEGAL);
    expect(verdict.kind).toBe("ok");
    expect(verdict.kind === "ok" ? verdict.rulings : []).toEqual([
      {
        finding: "F4",
        ruling: "REJECTED as stated",
        at: "2026-11-09T00:00:00Z",
        by: "orchestrator",
      },
    ]);
  });

  it("judges the `carrier` key in the lenient read too — the signature never lies", () => {
    const conforming = carrierDir();
    writeFileSync(conforming.sidecar, JSON.stringify(LEGAL), "utf8");
    // Same body, same file: the read and the verdict agree about WHICH carrier the
    // sidecar answers, so no caller can read a ruling set the gate would refuse.
    expect(CarrierRulings.read(conforming.sidecar, conforming.carrier)).toEqual({
      rulings: [
        {
          finding: "F4",
          ruling: "REJECTED as stated",
          at: "2026-11-09T00:00:00Z",
          by: "orchestrator",
        },
      ],
    });
    const foreign = carrierDir();
    writeFileSync(
      foreign.sidecar,
      JSON.stringify({ ...LEGAL, carrier: "phase-spec-review-2.c2.json" }),
      "utf8",
    );
    expect(CarrierRulings.read(foreign.sidecar, foreign.carrier)).toBeNull();
  });

  it("accepts a sidecar without the optional `carrier` key and without `at` / `by`", () => {
    const verdict = verdictOf({ rulings: [{ finding: "F1", ruling: "accepted" }] });
    expect(verdict).toEqual({ kind: "ok", rulings: [{ finding: "F1", ruling: "accepted" }] });
  });
});

describe("CarrierRulings — the nine refused shapes", () => {
  it("refuses a file that is not JSON", () => {
    const verdict = verdictOf("not json at all");
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("not JSON");
  });

  it("refuses a sidecar with no `rulings` key", () => {
    const verdict = verdictOf({ carrier: CARRIER });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("`rulings`");
  });

  it("refuses a `rulings` value that is not an array", () => {
    const verdict = verdictOf({ carrier: CARRIER, rulings: { F4: "no" } });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("not an array");
  });

  it("refuses a ruling with no `finding`", () => {
    const verdict = verdictOf({ rulings: [{ ruling: "accepted" }] });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("`finding`");
  });

  it("refuses a ruling with no `ruling`", () => {
    const verdict = verdictOf({ rulings: [{ finding: "F1" }] });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("`ruling`");
  });

  it("refuses an unknown top-level key", () => {
    const verdict = verdictOf({ ...LEGAL, extra: true });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("unknown top-level key");
  });

  it("refuses an unknown key inside a ruling", () => {
    const verdict = verdictOf({ rulings: [{ finding: "F1", ruling: "accepted", extra: 1 }] });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("unknown key");
  });

  it("refuses a ruling on a finding the carrier does not carry", () => {
    const verdict = verdictOf({ rulings: [{ finding: "F9", ruling: "accepted" }] });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain(
      "not a finding of the carrier",
    );
  });

  it("refuses a `carrier` key that does not name this carrier", () => {
    const verdict = verdictOf({ ...LEGAL, carrier: "phase-spec-review-2.c2.json" });
    expect(verdict.kind).toBe("invalid");
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain("≠ the carrier");
  });

  it("names the refused sidecar path in every reason", () => {
    const { carrier, sidecar } = carrierDir();
    mkdirSync(path.dirname(sidecar), { recursive: true });
    writeFileSync(sidecar, "{", "utf8");
    const verdict = CarrierRulings.verdict(sidecar, carrier, FINDING_IDS);
    expect(verdict.kind === "invalid" ? verdict.reason : "").toContain(sidecar);
  });
});

// ---------------------------------------------------------------------------
// P36 T5 — the `misplaced` side of the attribution grammar (spec §2.5): the
// `rulings` row's two tolerated spellings answer `misplaced`, never `ok` and never
// an orphan
// ---------------------------------------------------------------------------

describe("the `rulings` row's misplaced spellings (P36 T5 · §2.5)", () => {
  /** The reviewed round's identity — the `--reviews` carrier's own coordinates. */
  const IDENTITY: Identity = { domain: "round", line: "phase-spec", op: "review", cycle: 1 };

  /** A real workspace holding the given names (the read needs the directory). */
  const workspaceWith = (
    names: readonly string[],
  ): { workspace: Workspace; cleanup: () => void } => {
    const repo = mkdtempSync(path.join(tmpdir(), "carrier-rulings-grammar-"));
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "phase-spec").ensure();
    for (const name of names) writeFileSync(workspace.resolve(name), "{}\n", "utf8");
    return { workspace, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
  };

  it("answers `misplaced` for the `.c<cycle>`-less spelling the 89 shipped sidecars use", () => {
    const { workspace, cleanup } = workspaceWith(["phase-spec-review-1.rulings.json"]);
    try {
      const read = new ArtifactRegistry().read(IDENTITY, "rulings", workspace);
      expect(read.kind).toBe("misplaced");
      if (read.kind !== "misplaced") return;
      expect(read.derived).toBe("phase-spec-review-1.c1.rulings.json");
      expect(read.found).toEqual(["phase-spec-review-1.rulings.json"]);
    } finally {
      cleanup();
    }
  });

  it("answers `misplaced` for an explicit `-a1` — a spelling the renderer never mints", () => {
    const { workspace, cleanup } = workspaceWith(["phase-spec-review-1-a1.c1.rulings.json"]);
    try {
      const read = new ArtifactRegistry().read(IDENTITY, "rulings", workspace);
      expect(read.kind).toBe("misplaced");
      if (read.kind !== "misplaced") return;
      expect(read.found).toEqual(["phase-spec-review-1-a1.c1.rulings.json"]);
    } finally {
      cleanup();
    }
  });

  it("answers `absent` with no name on disk — absence is legal for this row", () => {
    const { workspace, cleanup } = workspaceWith([]);
    try {
      expect(new ArtifactRegistry().read(IDENTITY, "rulings", workspace).kind).toBe("absent");
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P36 T6 — the `rulings` read pair (spec §2.3 · §4.5): ONE carrier, the two
// spellings that attribute to it, and the unreadable arm that must never read as an
// absence. The gate and the round-context cell compose this read with the strict
// schema; the matrix's half is what these pins fix.
// ---------------------------------------------------------------------------

describe("the `rulings` row's one read (P36 T6 · §2.3 · §4.5)", () => {
  /** The reviewed round's identity — the carrier's own coordinate, `op` = review. */
  const IDENTITY: Identity = { domain: "round", line: "plan", op: "review", cycle: 1 };

  /** A real workspace holding the given names (the read needs the directory). */
  const workspaceWith = (
    names: readonly string[],
  ): { workspace: Workspace; cleanup: () => void } => {
    const repo = mkdtempSync(path.join(tmpdir(), "carrier-rulings-read-"));
    const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "plan").ensure();
    for (const name of names) writeFileSync(workspace.resolve(name), "{}\n", "utf8");
    return { workspace, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
  };

  it("attributes the misaligned and the rendered name to the SAME (identity, kind)", () => {
    // One carrier, two tolerated spellings: the round's identity is the same and so is
    // the kind, which is what makes the set-based judgment well defined.
    const registry = new ArtifactRegistry();
    const expected = { identity: IDENTITY, kind: "rulings" as const };
    expect(registry.attribute("plan-review-1.rulings.json")).toEqual(expected);
    expect(registry.attribute("plan-review-1.c1.rulings.json")).toEqual(expected);
  });

  it("answers `ok` at the rendered name and `misplaced` once the variant joins it", () => {
    const { workspace, cleanup } = workspaceWith(["plan-review-1.c1.rulings.json"]);
    try {
      const registry = new ArtifactRegistry();
      const read = registry.read(IDENTITY, "rulings", workspace);
      expect(read.kind).toBe("ok");
      // the rendered name is the only legal spelling; a variant beside it is a refusal
      writeFileSync(workspace.resolve("plan-review-1.rulings.json"), "{}\n", "utf8");
      const placed = registry.read(IDENTITY, "rulings", workspace);
      expect(placed.kind).toBe("misplaced");
      if (placed.kind !== "misplaced") return;
      expect(placed.derived).toBe("plan-review-1.c1.rulings.json");
      expect(placed.identity).toEqual(IDENTITY);
      expect([...placed.found].sort()).toEqual([
        "plan-review-1.c1.rulings.json",
        "plan-review-1.rulings.json",
      ]);
    } finally {
      cleanup();
    }
  });

  it("answers `invalid` with reason `unreadable` when the rendered name cannot be opened", () => {
    // "cannot read" never authorizes "is not there" (§4.5): the arm is distinct from
    // `absent`, and it is the arm the dispatch gate refuses on.
    const { workspace, cleanup } = workspaceWith(["plan-review-1.c1.rulings.json"]);
    const rendered = workspace.resolve("plan-review-1.c1.rulings.json");
    try {
      chmodSync(rendered, 0o000);
      const read = new ArtifactRegistry().read(IDENTITY, "rulings", workspace);
      expect(read.kind).toBe("invalid");
      if (read.kind !== "invalid") return;
      expect(read.reason).toBe("unreadable");
      expect(read.path).toBe(rendered);
    } finally {
      chmodSync(rendered, 0o644);
      cleanup();
    }
  });
});
