// packages/cdd-engine/src-next/session/__tests__/fix-round-gate.test.ts
// P42 T10 — the fix round's IN-ROUND contract gate (design spec §7). The
// `doc-contract` judgment stops being only the next hop's refusal: a fix round that
// writes a NEW violation into the document it repaired is BLOCKED in its own turn. The
// comparison is a delta against the findings the approved dispatch gate measured, never
// an absolute reading — a round taking over a document with history must still be able
// to close.
//
// The arms split along the two cells the change introduces:
//   · the BASELINE cell — `Lifecycle#advance()` hands the approved verdict's findings to
//     the frame (`OpenFrame.contract`), and the old folded gate leaves it empty;
//   · the CLOSE-OUT leg — `CliLifecycle#verdictOf` compares the round's own reading
//     against that cell on the fix face of a doc shape, as a multiset on the finding's
//     whole identity.
//
// Zero module-level bare functions — the helpers are `const` (the repository's
// zero-`function`-declaration discipline).

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TestDispatchValues } from "../../__tests__/support/dispatch-values.ts";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import type { Finding } from "../../contract/invariants.ts";
import { Contract } from "../../contract/judge.ts";
import { PinAudit } from "../../contract/pins.ts";
import type { CliOptions } from "../../face/cli.ts";
import { Cli } from "../../face/cli.ts";
import { type CliIo, CliLifecycle, type DispatchScene } from "../../face/lifecycle.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../../face/termination.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { RepoRoot } from "../../infra/root.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { TEMPLATE_PROMPT } from "../../render/templates.ts";
import { type TargetType, targetFaces } from "../faces.ts";
import { Ledger } from "../ledger.ts";
import type { PreFlightVerdict } from "../preflight.ts";
import { ArtifactRegistry } from "../round-artifacts.ts";
import { type DispatchOutcome, EMPTY_RUN_STATE, Lifecycle, type OpenFrame } from "../run.ts";

/** The one contract instance every arm judges with — the same registry the gate holds. */
const CONTRACT = new Contract();

/** A phase-spec carrier over the given `## Design` body lines — the document a fix
 *  round repairs. */
const specDoc = (body: readonly string[]): string =>
  [
    "---",
    "title: Fix Gate Fixture",
    "doc-type: phase-spec",
    "version: v0.1",
    "date: 2026-11-20",
    "slug: s1",
    "---",
    "",
    "## Design",
    "",
    "### 1. 目标",
    "",
    ...body,
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    "| v0.1 | 2026-11-20 | init | [human] |",
    "",
  ].join("\n");

/** The one violation this file writes — a bare measurement on the decision face. */
const MEASURE = "这一相位补了 42 rows。";

/** A second violation under the SAME heading — repairing the first and writing this one
 *  leaves the `kind@field` set unchanged while a defect is genuinely new. */
const MEASURE_OTHER = "这一相位又补了 7 tests。";

/** The IO seam — captures both channels (the soft-entry warn rides stderr). */
class CaptureIo implements CliIo {
  stdoutText = "";
  stderrText = "";

  stdout = (text: string): void => {
    this.stdoutText += text;
  };

  stderr = (text: string): void => {
    this.stderrText += text;
  };
}

/** The child stand-in — rewrites the judged document and lands the fix draft. */
class DocFixRunner implements ChildRunner {
  readonly calls: ChildRun[] = [];
  readonly #body: () => string;

  constructor(body: () => string) {
    this.#body = body;
  }

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    const doc = path.join(run.cwd, "docs", "k", "s.md");
    writeFileSync(
      doc,
      specDoc(
        this.#body()
          .split("\n")
          .filter((line) => line.length > 0),
      ),
      "utf8",
    );
    mkdirSync(path.join(run.cwd, ".kairos", "cdd", "fixgate"), { recursive: true });
    writeFileSync(
      path.join(run.cwd, ".kairos", "cdd", "fixgate", "phase-spec-fix-1.json"),
      JSON.stringify({ status: "APPROVED", artifacts: { doc: "docs/k/s.md" }, dispositions: {} }),
      "utf8",
    );
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

/** The child stand-in that writes nothing into the document — the silent pair. */
class QuietRunner implements ChildRunner {
  readonly calls: ChildRun[] = [];

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    mkdirSync(path.join(run.cwd, ".kairos", "cdd", "fixgate"), { recursive: true });
    writeFileSync(
      path.join(run.cwd, ".kairos", "cdd", "fixgate", "phase-spec-fix-1.json"),
      JSON.stringify({ status: "APPROVED", artifacts: { doc: "docs/k/s.md" }, dispositions: {} }),
      "utf8",
    );
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

interface Fixture {
  readonly scene: DispatchScene;
  readonly repoRoot: string;
  readonly doc: string;
  readonly io: CaptureIo;
  readonly cleanup: () => void;
}

/** A hermetic repo + workspace: one committed phase-spec document, one closed review
 *  round (the fix round's requesting carrier) and the ledger. */
const fixture = (): Fixture => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "fix-gate-")));
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "fix-gate@test"],
    ["config", "user.name", "fix-gate-test"],
  ]) {
    spawnSync("git", args, { cwd: repoRoot });
  }
  writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n", "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  const doc = path.join(repoRoot, "docs", "k", "s.md");
  mkdirSync(path.dirname(doc), { recursive: true });
  writeFileSync(doc, specDoc(["判据面正文。"]), "utf8");
  const planPath = path.join(repoRoot, "docs", "kairos", "plans", "p1.md");
  mkdirSync(path.dirname(planPath), { recursive: true });
  writeFileSync(planPath, "# plan\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "fixgate").ensure();
  const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
  // The requesting review round: an EMPTY findings set, so the fix criterion owes no
  // dispositions and the arm judges the contract leg alone.
  ledger.persistHandoff("review", "phase-spec", { round: 1 }, { findings: [] });
  ledger.recordRound("phase-spec", { op: "review", cycle: 1 });
  return {
    scene: {
      workspace,
      ledger,
      planPath,
      plan: planSourceOf(workspace.root.basis).readFor(null),
      briefPath: null,
      baseBranch: "develop",
    },
    repoRoot,
    doc,
    io: new CaptureIo(),
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
};

/** The baseline the APPROVED dispatch gate would have measured — the gate's own
 *  construction (doc key · absolute path · bytes · root · the closure fact), read here
 *  so the arms isolate the close-out leg from the pre-flight rows. */
const baselineOf = (f: Fixture, content = specDoc(["判据面正文。"])): readonly Finding[] =>
  CONTRACT.validate(
    {
      docKey: "phase-spec",
      path: f.doc,
      content,
      root: f.repoRoot,
      slugIndex: undefined,
      taskLayers: undefined,
    },
    new PinAudit(f.repoRoot).provenClosed("docs/k/s.md"),
  );

/** The docs-fix frame of the fixture's spec line, carrying its baseline. */
const fixFrame = (
  f: Fixture,
  baseline: readonly Finding[] | null,
  type: TargetType = "phase-spec",
): OpenFrame => ({
  type,
  phase: "fix",
  round: 1,
  target:
    type === "phase-spec"
      ? { kind: "spec", doc: path.relative(f.repoRoot, f.doc) }
      : { kind: "branch" },
  params: { round: 1, attempt: 1 },
  key: type === "phase-spec" ? "phase-spec" : "branch",
  attempt: 1,
  ...(baseline === null ? {} : { contract: baseline }),
});

/** Run one docs-fix frame through the production dispatch face. */
const runFix = async (
  f: Fixture,
  frame: OpenFrame,
  runner: ChildRunner,
): Promise<DispatchOutcome> => {
  const lifecycle = new CliLifecycle({
    contract: CONTRACT,
    scene: f.scene,
    artifacts: new ArtifactRegistry(),
    io: f.io,
    sync: runner,
    host: "claude",
    values: TestDispatchValues.of(f.scene, frame, {
      reviews: TestDispatchValues.reviewsOf(f.scene, frame),
    }),
  });
  return lifecycle.step()(frame);
};

/** The round's graded entries that name the contract leg — the arms filter to these so
 *  an unrelated soft observation cannot pose as the verdict. */
const contractEntries = (outcome: DispatchOutcome) =>
  (outcome.violations ?? []).filter((violation) =>
    violation.message.includes("violates its own contract"),
  );

describe("P42 T10 — the baseline cell rides the frame", () => {
  const baseline: readonly Finding[] = [
    {
      path: "docs/k/s.md",
      field: "## Design",
      message: "the decision face states a bare measurement: 3 行",
      fix: "state the count as census:<id> = <n>",
      kind: "measure-literal",
      severity: "warn",
    },
  ];

  /** One approved verdict over the baseline — the gate's own shape. */
  const verdict = (ok: boolean, findings: readonly Finding[] = baseline): PreFlightVerdict => ({
    ok,
    order: ["tree-clean", "doc-contract"],
    checked: ["tree-clean", "doc-contract"],
    findings,
  });

  it("hands the approved verdict's findings to the dispatch as the round baseline", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "fix-gate-run-"));
    try {
      const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "fixgate");
      const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
      const frames: OpenFrame[] = [];
      const run = new Lifecycle({
        face: targetFaces["phase-spec"],
        state: EMPTY_RUN_STATE,
        ledger,
        plan: planSourceOf(new RepoRoot("/")).readFor(null),
        preflight: { gate: () => verdict(true) },
        dispatch: async (frame) => {
          frames.push(frame);
          return { status: "APPROVED" };
        },
        target: { kind: "spec", doc: "docs/kairos/specs/x-design.md" },
      });
      expect(await run.advance()).not.toBeNull();
      // The frame carries the gate's readings themselves — not a copy, not a count.
      expect(frames[0]?.contract).toBe(baseline);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("leaves the baseline empty when the gate is folded to `null` — the production wiring is what carries it", async () => {
    // The OLD wiring (`ok ? null : verdict`) is reproduced here: the dispatch still runs,
    // and the frame holds no baseline — which is exactly the state that makes a real
    // production round blind while a stub-fed test stays green.
    const repo = mkdtempSync(path.join(tmpdir(), "fix-gate-fold-"));
    try {
      const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "fixgate");
      const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
      const frames: OpenFrame[] = [];
      const approved = verdict(true);
      const run = new Lifecycle({
        face: targetFaces["phase-spec"],
        state: EMPTY_RUN_STATE,
        ledger,
        plan: planSourceOf(new RepoRoot("/")).readFor(null),
        preflight: { gate: () => (approved.ok ? null : approved) },
        dispatch: async (frame) => {
          frames.push(frame);
          return { status: "APPROVED" };
        },
        target: { kind: "spec", doc: "docs/kairos/specs/x-design.md" },
      });
      await run.advance();
      expect(frames[0]?.contract).toBeUndefined();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("still blocks a refused verdict before any child exists", async () => {
    // The refusal arm is untouched by the new cell: `verdict !== null && !verdict.ok`
    // keeps its semantics, and the dispatch is never reached.
    const repo = mkdtempSync(path.join(tmpdir(), "fix-gate-refuse-"));
    try {
      const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "fixgate");
      const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
      const frames: OpenFrame[] = [];
      const refused: PreFlightVerdict = {
        ok: false,
        gate: "doc-contract",
        reason: "doc-contract",
        message: "refused",
        order: ["doc-contract"],
        checked: ["doc-contract"],
      };
      const run = new Lifecycle({
        face: targetFaces["phase-spec"],
        state: EMPTY_RUN_STATE,
        ledger,
        plan: planSourceOf(new RepoRoot("/")).readFor(null),
        preflight: { gate: () => refused },
        dispatch: async (frame) => {
          frames.push(frame);
          return { status: "APPROVED" };
        },
        target: { kind: "spec", doc: "docs/kairos/specs/x-design.md" },
      });
      const step = await run.advance();
      expect(step?.preflight).toBe(refused);
      expect(frames).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("P42 T10 — the close-out leg", () => {
  it("blocks a fix round that writes a new violation into the document it repaired", async () => {
    const f = fixture();
    try {
      const baseline = baselineOf(f);
      const outcome = await runFix(f, fixFrame(f, baseline), new DocFixRunner(() => MEASURE));
      const entries = contractEntries(outcome);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.grade).toBe("hard");
      // The existing cause — zero new violation enum — and one row per added finding.
      expect(entries[0]?.cause).toBe("contract-violation");
      expect(entries[0]?.message).toContain("measure-literal@");
      expect(outcome.status).toBe("BLOCKED");
    } finally {
      f.cleanup();
    }
  });

  it("passes the same round when its write adds nothing (the pair)", async () => {
    const f = fixture();
    try {
      const baseline = baselineOf(f);
      const outcome = await runFix(f, fixFrame(f, baseline), new QuietRunner());
      expect(contractEntries(outcome)).toEqual([]);
      expect(outcome.status).toBe("APPROVED");
    } finally {
      f.cleanup();
    }
  });

  it("judges only the delta — a document that arrives with a violation may keep it", async () => {
    const f = fixture();
    try {
      // The document ALREADY carries the violation: the baseline holds it, so the round
      // that leaves it alone is not blamed for history it inherited.
      writeFileSync(f.doc, specDoc([MEASURE]), "utf8");
      const baseline = baselineOf(f, specDoc([MEASURE]));
      expect(baseline.filter((finding) => finding.kind === "measure-literal")).toHaveLength(1);
      const outcome = await runFix(f, fixFrame(f, baseline), new QuietRunner());
      expect(contractEntries(outcome)).toEqual([]);
      expect(outcome.status).toBe("APPROVED");
    } finally {
      f.cleanup();
    }
  });

  it("reports only the ADDED one — a second violation beside the inherited one", async () => {
    const f = fixture();
    try {
      writeFileSync(f.doc, specDoc([MEASURE]), "utf8");
      const baseline = baselineOf(f, specDoc([MEASURE]));
      const outcome = await runFix(
        f,
        fixFrame(f, baseline),
        new DocFixRunner(() => [MEASURE, MEASURE_OTHER].join("\n")),
      );
      const entries = contractEntries(outcome);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.message).toContain("7 tests");
      // the inherited row is not restated as new
      expect(entries[0]?.message).not.toContain("42 rows");
    } finally {
      f.cleanup();
    }
  });

  it("compares the WHOLE identity — repairing one row under a heading and writing another is new", async () => {
    const f = fixture();
    try {
      writeFileSync(f.doc, specDoc([MEASURE]), "utf8");
      const baseline = baselineOf(f, specDoc([MEASURE]));
      // The round REPAIRS the inherited row and writes a different one under the SAME
      // heading: `kind@field` is unchanged on both sides, so a set difference there would
      // read zero — the multiset on the full identity reads one.
      const outcome = await runFix(f, fixFrame(f, baseline), new DocFixRunner(() => MEASURE_OTHER));
      const entries = contractEntries(outcome);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.message).toContain("7 tests");
    } finally {
      f.cleanup();
    }
  });

  it("reads a baseline row the round kept at ANY tier as known — the baseline is the gate's reading, not an absolute", async () => {
    const f = fixture();
    try {
      // A `block`-severity row in the baseline is the one state the dispatch gate could
      // not have let through — the document brings it, and the arm raises its tier to
      // pin the close-out's reading: a same-identity row is KNOWN whatever its tier, so
      // the leg never re-blames reading it. The baseline is the gate's measurement, never
      // an absolute standard the round is held to.
      const written = specDoc(["这一处补了 5 rows。"]);
      writeFileSync(f.doc, written, "utf8");
      const inherited = baselineOf(f, written).map((finding) => ({
        ...finding,
        severity: "block" as const,
      }));
      expect(inherited.length).toBeGreaterThan(0);
      const outcome = await runFix(f, fixFrame(f, inherited), new QuietRunner());
      expect(contractEntries(outcome)).toEqual([]);
    } finally {
      f.cleanup();
    }
  });

  it("runs on the doc faces only — a branch round has no doc face to re-read", async () => {
    const f = fixture();
    try {
      const baseline = baselineOf(f);
      const outcome = await runFix(
        f,
        fixFrame(f, baseline, "branch"),
        new DocFixRunner(() => MEASURE),
      );
      expect(contractEntries(outcome)).toEqual([]);
    } finally {
      f.cleanup();
    }
  });

  it("keeps the baseline off the progress file, the carrier and the in-flight record", async () => {
    const f = fixture();
    try {
      const baseline = baselineOf(f);
      await runFix(f, fixFrame(f, baseline), new QuietRunner());
      const read = (name: string): string => {
        try {
          return readFileSync(f.scene.workspace.resolve(name), "utf8");
        } catch {
          return "";
        }
      };
      for (const name of ["progress.json", "phase-spec-fix-1.json", "in-flight.json"]) {
        const text = read(name);
        // The frame cell never lands on disk: neither the key nor the finding's own
        // message text appears in any of the three stores.
        expect(text).not.toContain("contract");
        expect(text).not.toContain("bare measurement");
      }
      // The fix carrier is a work-plane carrier: it holds no findings slot at all.
      const carrier = JSON.parse(read("phase-spec-fix-1.json")) as Record<string, unknown>;
      expect(carrier).not.toHaveProperty("findings");
    } finally {
      f.cleanup();
    }
  });
});
describe("P42 T10 — the fix prompt's write constraints", () => {
  it("names each of the three shape rules exactly once in the docs-fix shell", () => {
    const shell = TEMPLATE_PROMPT.modes["docs-fix"].shell.join("\n");
    const NAMED = ["measure-literal", "line-coordinate", "live-arithmetic"] as const;
    for (const rule of NAMED) {
      expect(shell.split(rule).length - 1, rule).toBe(1);
    }
    // The row names the WRITE constraints and nothing else: the two remaining
    // closed-document-exempt rows describe a record the round does not write, so a
    // fourth name is the row drifting, not the shell growing.
    for (const rule of ["single-home", "change-history-date-shape"]) {
      expect(shell, rule).not.toContain(rule);
    }
    // the pair: a shell that names none of them is what this arm would catch, and the
    // work shells never carry the three (they write no document)
    const work = TEMPLATE_PROMPT.modes.implement.shell.join("\n");
    expect(work).not.toContain("measure-literal");
  });
});

describe("P42 T10 — the structure comment reads two evaluation points", () => {
  it("names the pre-dispatch gate AND the fix round's close-out, and drops the single-point sentence", () => {
    const source = readFileSync(new URL("../run.ts", import.meta.url), "utf8");
    const singlePoint =
      "the engine's single doc-contract evaluation point is the pre-dispatch gate";
    expect(source).not.toContain(singlePoint);
    // the two points are named together, in the same sentence, so a reader cannot take
    // one for the whole engine
    expect(source).toContain("TWO doc-contract evaluation points");
    expect(source).toContain("pre-dispatch gate");
    expect(source).toContain("close-out leg");
  });
});

/** The composition root's own fixture — a real repo holding a plan whose two tasks
 *  both declare `Create:` of one path (the `single-create` row is `warn`, so the
 *  production dispatch gate APPROVES the round and hands its reading over as the
 *  baseline) plus the completed review round that owes the fix. */
const PRODUCTION_PLAN = [
  "---",
  "title: Production Plan",
  "doc-type: plan",
  "version: v1.0",
  "date: 2026-11-20",
  "slug: p3",
  "base: develop",
  "---",
  "",
  "## Constraints",
  "",
  "- delta",
  "",
  ...[1, 2].flatMap((id) => [
    `### Task ${id}:`,
    "- **Objective**: objective",
    "- **Files**: Create `a.ts`",
    "- **Consumes**: x",
    "- **Produces**: y",
    "- **Steps**:",
    "  - step — checkable: green",
    "- **Acceptance**: ok",
    `- **DependsOn**: ${id === 1 ? "none" : "1"}`,
    "",
  ]),
  "## Change history",
  "",
  "| Version | date | summary | author |",
  "|---|---|---|---|",
  "| v1.0 | 2026-11-20 | init | [human] |",
  "",
].join("\n");

/** The child stand-in for the production round — lands the docs-fix carrier with the
 *  one requested finding disposed, and edits no document. */
class ProductionFixRunner implements ChildRunner {
  readonly calls: ChildRun[] = [];

  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    const workspace = path.join(run.cwd, ".kairos", "cdd", "p3");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(
      path.join(workspace, "plan-fix-1.json"),
      JSON.stringify({
        status: "APPROVED",
        artifacts: {},
        dispositions: { F1: { status: "fixed" } },
      }),
      "utf8",
    );
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

describe("P42 T10 — the composition root carries the gate's readings to the frame", () => {
  it("a Cli-built docs-fix round dispatches with the gate's own non-empty baseline", async () => {
    // The arm the stub gate cannot be: the wiring under test is the CLI's own
    // `preflight: { gate: () => preflight }`. A folded gate (`ok ? null : preflight`)
    // leaves the frame's cell empty here while every stub-fed arm stays green — the
    // production round then compares against nothing and reports the document's own
    // inherited reading as new.
    const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "fix-gate-prod-")));
    const cwd = process.cwd();
    const frames: OpenFrame[] = [];
    const originalStep = CliLifecycle.prototype.step;
    const spy = vi.spyOn(CliLifecycle.prototype, "step").mockImplementation(function (
      this: CliLifecycle,
    ) {
      const step = originalStep.call(this);
      return async (frame: OpenFrame) => {
        frames.push(frame);
        return step(frame);
      };
    });
    try {
      for (const args of [
        ["init", "-q"],
        ["config", "user.email", "fix-gate@test"],
        ["config", "user.name", "fix-gate-test"],
      ]) {
        spawnSync("git", args, { cwd: repo });
      }
      writeFileSync(path.join(repo, ".gitignore"), ".kairos\n", "utf8");
      const planPath = path.join(repo, "docs", "kairos", "plans", "p3.md");
      mkdirSync(path.dirname(planPath), { recursive: true });
      writeFileSync(planPath, PRODUCTION_PLAN, "utf8");
      // The identity documents the slug index reads — the same-slug spec and the
      // program overall, so the plan path resolves to exactly one identity.
      const specPath = path.join(repo, "docs", "kairos", "specs", "p3-design.md");
      mkdirSync(path.dirname(specPath), { recursive: true });
      writeFileSync(
        specPath,
        "---\ntitle: S\ndoc-type: phase-spec\nslug: p3\nprogram: p3-overall\n---\n",
        "utf8",
      );
      writeFileSync(
        path.join(repo, "docs", "kairos", "specs", "p3-overall.md"),
        "---\ntitle: O\ndoc-type: overall\nslug: p3-overall\n---\n",
        "utf8",
      );
      spawnSync("git", ["add", "-A"], { cwd: repo });
      spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repo });
      // The requesting review round: one `warn` finding, so the fix is owed and the
      // plan line's pending fix is the round's reason to exist.
      const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), "p3").ensure();
      const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
      ledger.persistHandoff(
        "review",
        "plan",
        { round: 1 },
        { findings: [{ id: "F1", severity: "warn", summary: "the plan creates a.ts twice" }] },
      );
      ledger.recordRound("plan", { op: "review" });
      process.chdir(repo);
      const io = new CaptureIo();
      const options: CliOptions = { io, sync: new ProductionFixRunner() };
      const code = await Cli.create(options).runArgv(["fix", "--type", "plan", "--plan", planPath]);
      expect(io.stderrText).not.toContain("CDD_BLOCKED");
      expect(frames).toHaveLength(1);
      const baseline = frames[0]?.contract;
      expect(baseline).toBeDefined();
      // The cell IS the gate's reading of this document — a non-empty set naming the
      // one rule the plan trips, never a copy and never a re-judgment.
      expect(baseline?.map((finding) => finding.kind)).toEqual(["single-create"]);
      expect(code).toBe(0);
    } finally {
      spy.mockRestore();
      process.chdir(cwd);
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
