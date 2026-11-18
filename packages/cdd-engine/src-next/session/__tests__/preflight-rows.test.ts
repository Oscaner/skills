// packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts
// P40 T4 — the four pre-dispatch rows at the SEAM (design spec §1.1 · §2.1 · §3.2 ·
// §3.3). The rows themselves are the contract plane's (`contract/preflight-rows.ts`,
// P40 T3); this suite pins the seam that calls them:
//
//   · the missing host — `no-host` is a structure row, and the assembled
//     `CDD_BLOCKED` line carries the station exactly once;
//   · a bad value — `dispatch-input`, its station stripped from the verdict's
//     `message` (the authority puts it back on, the ONE place that does);
//   · three rows at once — the first owns `message`, the rest ride `details`, and each
//     sentence appears exactly once in the assembled block;
//   · a bad document AND bad values — the document gate still refuses first;
//   · the pre-frame composer — callable with no frame and no workspace, and its record
//     renders to the SAME prompt the frame-bound lifecycle renders (the wave face and
//     the fix face, so the `WAVE` and `INPUT_REVIEWS` cells are both covered);
//   · the nine station words and the reason table's four structure rows are ONE
//     vocabulary;
//   · the snapshot's two arms are both alive — a tampered carrier refuses as `carrier`,
//     an unreadable sidecar as `artifact`;
//   · the family-name branch's index is the CYCLE only (the attempt belongs to the
//     review's own record);
//   · the priority shift — a dispatch that breaks both a gate and its line reports the
//     gate, and the line's refusal is still reachable once the gate is cleared.
//
// Zero module-level bare functions — every helper is an arrow const.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planSourceOf } from "../../__tests__/support/plan-source.ts";
import { CarrierLine } from "../../contract/carrier-line.ts";
import { PlanDocType } from "../../contract/doc.ts";
import { Contract } from "../../contract/judge.ts";
import type { ArtifactSnapshot, ArtifactSnapshotRead } from "../../contract/preflight-rows.ts";
import {
  type DispatchIdentity,
  type DispatchSceneFacts,
  DispatchValues,
  RequestingCarrier,
} from "../../face/dispatch-values.ts";
import { CliLifecycle } from "../../face/lifecycle.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../../face/termination.ts";
import { Words } from "../../face/words.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { GitClient } from "../../infra/git.ts";
import type { RepoPath } from "../../infra/root.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { TemplateAssembler } from "../../render/templates.ts";
import { HandoffSchema } from "../../session/handoff-schema.ts";
import type { DispatchRequest } from "../dispatch-authority.ts";
import { DispatchAuthority } from "../dispatch-authority.ts";
import { TaskGraph } from "../graph.ts";
import { InFlight } from "../inflight.ts";
import { Ledger } from "../ledger.ts";
import { DISPATCH_REASON } from "../next.ts";
import {
  PreFlight,
  type PreFlightContext,
  type PreFlightGateName,
  type PreFlightVerdict,
} from "../preflight.ts";
import { ArtifactRegistry } from "../round-artifacts.ts";
import { RoundNaming } from "../round-naming.ts";
import type { OpenFrame } from "../run.ts";

/** The structure leg's nine station words — the seam's row set. */
const NINE_ROWS: readonly PreFlightGateName[] = [
  "tree-clean",
  "in-flight",
  "graph",
  "plan-ledger",
  "doc-contract",
  "no-host",
  "carrier",
  "dispatch-input",
  "artifact",
];

/** The four pre-dispatch rows, in judgment order. */
const FOUR_ROWS: readonly PreFlightGateName[] = [
  "no-host",
  "carrier",
  "dispatch-input",
  "artifact",
];

/** The no-sidecar artifact snapshot. */
const ABSENT_SNAPSHOT: ArtifactSnapshotRead = {
  kind: "absent",
  path: null,
  reason: null,
  found: [],
  identity: null,
  sidecarKind: null,
};

/** The healthy read arm — an absent sidecar, no requesting-carrier path. */
const ABSENT_ARTIFACT: ArtifactSnapshot = {
  kind: "read",
  reviewsPath: null,
  read: ABSENT_SNAPSHOT,
};

/** A capturing io — the lifecycle's stderr face is asserted, never printed. */
class CaptureIo {
  stdoutText = "";
  stderrText = "";
  stdout(text: string): void {
    this.stdoutText += text;
  }
  stderr(text: string): void {
    this.stderrText += text;
  }
}

/** A child stand-in that records the ONE prompt argument and exits clean. */
class PromptRunner implements ChildRunner {
  calls: ChildRun[] = [];
  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

/** The plan literal over `### Task N:` blocks (the plan grammar's minimal shape). */
const planDoc = (): string =>
  [
    "---",
    "title: Test Plan",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: x-p40",
    "---",
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    "### Task 1: one",
    "- **DependsOn**: none",
    "",
    "### Task 2: two",
    "- **DependsOn**: 1",
    "",
  ].join("\n");

/** Commit everything in the fixture repo (a clean tree after a case's own writes). */
const commitAll = (repo: string): void => {
  spawnSync("git", ["add", "-A"], { cwd: repo });
  spawnSync("git", ["commit", "-q", "-m", "fixture"], { cwd: repo });
};

interface Fixture {
  readonly repo: string;
  readonly workspace: Workspace;
  readonly ledger: Ledger;
  readonly tasks: readonly number[];
  readonly cleanup: () => void;
}

/** A hermetic clean git repo + one workspace + its ledger + the READY plan document
 *  (the graph gate's own input, so a passing verdict carries the whole applicable row
 *  set: `tree-clean` · `in-flight` · `graph` · `plan-ledger` + the four input rows). */
const fixtureOf = (slug = "p40-slug"): Fixture => {
  const repo = realpathSync(mkdtempSync(path.join(tmpdir(), "preflight-rows-")));
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "rows@test"],
    ["config", "user.name", "rows-test"],
  ]) {
    spawnSync("git", args, { cwd: repo });
  }
  writeFileSync(path.join(repo, ".gitignore"), ".kairos\n", "utf8");
  writeFileSync(path.join(repo, "seed.txt"), "seed\n", "utf8");
  const planRel = "docs/kairos/plans/x-p40.md";
  mkdirSync(path.dirname(path.join(repo, planRel)), { recursive: true });
  writeFileSync(path.join(repo, planRel), planDoc(), "utf8");
  const specRel = "docs/kairos/specs/x-p40-design.md";
  mkdirSync(path.dirname(path.join(repo, specRel)), { recursive: true });
  writeFileSync(
    path.join(repo, specRel),
    "---\ntitle: S\ndoc-type: phase-spec\nslug: x-p40\n---\n",
    "utf8",
  );
  const workspace = new Workspace(new WorkspaceRoot(repo, ".kairos/cdd"), slug).ensure();
  const ledger = new Ledger(workspace, new ConfigLoader(), planSourceOf(workspace.root.basis));
  spawnSync("git", ["add", "-A"], { cwd: repo });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repo });
  return {
    repo,
    workspace,
    ledger,
    tasks: [1, 2],
    cleanup: () => rmSync(repo, { recursive: true, force: true }),
  };
};

/** The healthy wave value record — every declared cell of the implement row supplied. */
const waveValuesOf = (over: Record<string, string> = {}): Record<string, string> => ({
  ROLE: "implement",
  WAVE: "1",
  INPUT_WAVE_BRIEF: "tasks-1-brief.md",
  OUTPUT_REPORT: "tasks-1-implement-1-report.md",
  OUTPUT_EVIDENCE: "tasks-1-implement-1-test-evidence.json",
  OUTPUT_HANDOFF: "tasks-1-implement-1.json",
  WORKSPACE_DIR: ".kairos/cdd/p40-slug",
  WORKSPACE_ID: "p40-slug",
  ...over,
});

/** The wave-face pre-flight context of one fixture. */
const waveCtxOf = (fixture: Fixture, over: Partial<PreFlightContext> = {}): PreFlightContext => {
  const values = waveValuesOf();
  return {
    type: "wave",
    repoRoot: fixture.repo,
    plan: planSourceOf(fixture.workspace.root.basis).readPath("docs/kairos/plans/x-p40.md"),
    ledger: fixture.ledger,
    doc: null,
    inflight: new InFlight(fixture.workspace.root, fixture.workspace.slug, {
      live: async () => false,
    }),
    host: "claude",
    values,
    declarations: new TemplateAssembler().layoutOf(values),
    scene: { program: false, docType: false },
    artifact: ABSENT_ARTIFACT,
    ...over,
  };
};

/** The seam under judgment — real git + the real contract, the fixture's own files. */
const preflightOf = (): PreFlight =>
  new PreFlight({ git: new GitClient(), contract: new Contract(), words: new Words() });

/** The assembled block the command face prints for one structure refusal — the ONE
 *  shape `Cli#renderPreflightBlocked` renders (message first, then the details). */
const blockedBlock = (verdict: PreFlightVerdict): string => {
  const words = new Words();
  const refusal = new DispatchAuthority().structureRefusal(verdict);
  if (refusal === null) throw new Error("expected a structure refusal");
  const message = new DispatchAuthority().message(refusal, { detail: verdict.message });
  return [`${words.station("blocked")} ${message}`, ...(verdict.details ?? [])].join("\n");
};

/** The number of times one sentence appears in a block. */
const occurrencesOf = (block: string, sentence: string): number => block.split(sentence).length - 1;

describe("PreFlight — the four pre-dispatch rows (P40 T4)", () => {
  it("refuses a tree with no host harness on the `no-host` row", async () => {
    const fixture = fixtureOf();
    try {
      const verdict = await preflightOf().vet(waveCtxOf(fixture, { host: "" }));
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("no-host");
      // The dispatch path carries no reason word from `PreFlightReason`: the gate names
      // the station and the row's own detail names the reason.
      expect(verdict.reason).toBeUndefined();
      const words = new Words();
      expect(verdict.message).toBe(words.preflightWording().noHost);
      expect(verdict.details).toEqual([]);
      expect(blockedBlock(verdict)).toBe(
        `${words.station("blocked")} no-host · ${words.preflightWording().noHost}`,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("refuses an empty required cell on the `dispatch-input` row, station stripped once", async () => {
    const fixture = fixtureOf();
    try {
      const values = waveValuesOf({ OUTPUT_HANDOFF: "" });
      const verdict = await preflightOf().vet(
        waveCtxOf(fixture, {
          values,
          declarations: new TemplateAssembler().layoutOf(values),
        }),
      );
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("dispatch-input");
      // The verdict's message is the row's detail WITHOUT its station (the authority
      // puts it back) — so `dispatch-input` appears once in the assembled line.
      expect(verdict.message).toBe("implement · OUTPUT_HANDOFF · empty-value");
      expect(blockedBlock(verdict)).toBe(
        `${new Words().station("blocked")} dispatch-input · implement · OUTPUT_HANDOFF · empty-value`,
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("reports every violating row in one pass — the first owns `message`, the rest `details`", async () => {
    const fixture = fixtureOf();
    try {
      const carrier = {
        line: "docs/kairos/specs/x-review-1.json",
        recorded: "aaaaaaaa",
        current: "bbbbbbbb",
      };
      const values = waveValuesOf({ OUTPUT_REPORT: "" });
      const verdict = await preflightOf().vet(
        waveCtxOf(fixture, {
          host: "",
          values,
          declarations: new TemplateAssembler().layoutOf(values),
          artifact: { kind: "mismatch", reviewsPath: null, carrier },
        }),
      );
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("no-host");
      const words = new Words();
      const carrierLine = CarrierLine.of(carrier);
      const inputLine = "dispatch-input · implement · OUTPUT_REPORT · empty-value";
      expect(verdict.details).toEqual([carrierLine, inputLine]);
      const block = blockedBlock(verdict);
      // Each sentence lands exactly ONCE — the first row's detail is not repeated under
      // `details` (the renderer prints `message` and then `details`).
      expect(occurrencesOf(block, words.preflightWording().noHost)).toBe(1);
      expect(occurrencesOf(block, carrierLine)).toBe(1);
      expect(occurrencesOf(block, "OUTPUT_REPORT · empty-value")).toBe(1);
      // The row order is the judgment's own — `no-host` → `carrier` → `dispatch-input`.
      expect(verdict.order.slice(-4)).toEqual([...FOUR_ROWS]);
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps the document gate ahead of the four input rows", async () => {
    const fixture = fixtureOf();
    try {
      const doc = path.join(fixture.repo, "docs", "kairos", "specs", "p40-design.md");
      mkdirSync(path.dirname(doc), { recursive: true });
      // A readable document that declares no `doc-type:` — the doc-contract gate's own
      // refusal, reached before any input row is judged.
      writeFileSync(doc, "---\ntitle: X\nversion: v1.0\nslug: x-p40\n---\n", "utf8");
      commitAll(fixture.repo);
      const values = waveValuesOf({ OUTPUT_REPORT: "" });
      const verdict = await preflightOf().vet(
        waveCtxOf(fixture, {
          type: "phase-spec",
          doc: { docKey: null, path: "docs/kairos/specs/p40-design.md" as RepoPath },
          host: "",
          values,
          declarations: new TemplateAssembler().layoutOf(values),
        }),
      );
      expect(verdict.gate).toBe("doc-contract");
      // The four rows never ran: the doc gate short-circuits the sequence.
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "doc-contract"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("maps the nine station words onto the reason table's structure rows", () => {
    const structureTokens = Object.values(DISPATCH_REASON)
      .filter((row) => row.leg === "structure")
      .map((row) => row.token);
    expect([...structureTokens].sort()).toEqual([...NINE_ROWS].sort());
    // The four new rows carry the station word itself — no second spelling.
    expect(DISPATCH_REASON.noHost).toEqual({ token: "no-host", leg: "structure" });
    expect(DISPATCH_REASON.carrier).toEqual({ token: "carrier", leg: "structure" });
    expect(DISPATCH_REASON.dispatchInput).toEqual({ token: "dispatch-input", leg: "structure" });
    expect(DISPATCH_REASON.artifact).toEqual({ token: "artifact", leg: "structure" });
  });

  it("keeps both arms of the snapshot alive — a tampered carrier and an unreadable sidecar", async () => {
    const fixture = fixtureOf();
    try {
      const carrier = { line: "spec-review-1.json", recorded: "11112222", current: "33334444" };
      const mismatch = await preflightOf().vet(
        waveCtxOf(fixture, {
          artifact: { kind: "mismatch", reviewsPath: null, carrier },
        }),
      );
      expect(mismatch.gate).toBe("carrier");
      expect(mismatch.message).toBe(CarrierLine.of(carrier));

      const invalid: ArtifactSnapshot = {
        kind: "read",
        reviewsPath: null,
        read: { ...ABSENT_SNAPSHOT, kind: "invalid", path: "x.rulings.json", reason: "unreadable" },
      };
      const artifact = await preflightOf().vet(waveCtxOf(fixture, { artifact: invalid }));
      expect(artifact.gate).toBe("artifact");
      expect(artifact.message).toBe("rulings sidecar — unreadable");
    } finally {
      fixture.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the pre-frame composer — ONE assembly, two consumers
// ---------------------------------------------------------------------------

/** The scene facts the composition root hands the composer, derived frame-free from the
 *  same fixture the lifecycle reads (the producer's own rules, never the frame's). */
const sceneFactsOf = (
  fixture: Fixture,
  phase: "implement" | "fix",
  type: "wave" | "phase-spec",
) => {
  const op = phase;
  const tasks = type === "wave" ? "1" : "";
  const cycle = 1;
  const attempt = 1;
  const roundArtifact = RoundNaming.artifactOf(op, type, { tasks, round: cycle, attempt });
  const plane = HandoffSchema.planeOf(op);
  const facts: DispatchSceneFacts = {
    repoRoot: fixture.workspace.root.basis,
    docPath: type === "wave" ? null : "docs/k/s.md",
    planPath: null,
    specLink: null,
    overallLink: null,
    baseBranch: "develop",
    briefPath: tasks === "" ? "" : fixture.ledger.naming().brief(tasks),
    workspaceDir: fixture.workspace.path,
    workspaceId: fixture.workspace.slug,
    reportPath: path.join(fixture.workspace.path, RoundNaming.renderName(roundArtifact, "report")),
    evidencePath:
      type === "wave"
        ? path.join(fixture.workspace.path, RoundNaming.renderName(roundArtifact, "evidence"))
        : "",
    handoffPath: fixture.ledger.handoffPath(op, type, { tasks, round: cycle, attempt }),
    handoffSchema: new HandoffSchema().schemaText(plane, plane === "work" && type === "wave"),
  };
  return { facts, roundArtifact };
};

/** The wave implement frame of the fixture's single task. */
const waveFrame = (): OpenFrame => ({
  type: "wave",
  phase: "implement",
  round: 1,
  target: { kind: "wave", tasks: [1] },
  params: { tasks: "1", round: 1, attempt: 1 },
  key: "1",
  attempt: 1,
});

/** The doc line's fix frame — the requesting carrier is its input. */
const fixFrame = (): OpenFrame => ({
  type: "phase-spec",
  phase: "fix",
  round: 1,
  target: { kind: "spec", doc: "docs/k/s.md" },
  params: { round: 1, attempt: 1 },
  key: "phase-spec",
  attempt: 1,
});

/** The fixture's lifecycle scene (the spec document exists on disk, the base artifact is
 *  named) — the frame-bound consumer the composer must agree with. */
const sceneOf = (fixture: Fixture) => ({
  workspace: fixture.workspace,
  ledger: fixture.ledger,
  planPath: null,
  plan: planSourceOf(fixture.workspace.root.basis).readFor(null),
  briefPath: fixture.workspace.resolve(fixture.ledger.naming().briefName("1")),
  baseBranch: "develop",
  specLink: null,
  overallLink: null,
  program: null,
  docType: "phase-spec" as const,
});

describe("DispatchValues.compose — the pre-frame record is the rendered one", () => {
  it("renders the same wave prompt the frame-bound lifecycle renders (WAVE included)", async () => {
    const fixture = fixtureOf();
    try {
      const runner = new PromptRunner();
      const lifecycle = new CliLifecycle({
        scene: sceneOf(fixture),
        artifacts: new ArtifactRegistry(),
        io: new CaptureIo(),
        sync: runner,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
      });
      await lifecycle.step()(waveFrame());
      expect(runner.calls).toHaveLength(1);

      const identity: DispatchIdentity = {
        op: "implement",
        type: "wave",
        phase: "implement",
        tasks: "1",
        cycle: 1,
        attempt: 1,
      };
      const { facts } = sceneFactsOf(fixture, "implement", "wave");
      const values = DispatchValues.compose(identity, facts, ABSENT_ARTIFACT);
      expect(values.WAVE).toBe("1");
      // The pair's FIRST half is the RECORD, cell by cell: a cell the role's declaration
      // drops from the prompt (`INPUT_REVIEWS` off the fix face, the review face's
      // `WAVE`) is invisible in the bytes, so only the two records can witness the
      // agreement the seam and the renderer rely on.
      expect(values).toEqual(lifecycle.valuesOf(waveFrame()));
      const prompt = new TemplateAssembler().render(values);
      // The child's ONE positional is the prompt with the host's skill-ref prefix in
      // front of it; the PREFIX is the host channel's, the prompt bytes are the values'.
      expect(runner.calls[0]!.args.at(-1)!.endsWith(prompt)).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("renders the same fix prompt the frame-bound lifecycle renders (INPUT_REVIEWS included)", async () => {
    const fixture = fixtureOf();
    try {
      const specDoc = path.join(fixture.repo, "docs", "k", "s.md");
      mkdirSync(path.dirname(specDoc), { recursive: true });
      writeFileSync(specDoc, "# doc\n", "utf8");
      // The requesting review round: one recorded review carrier on disk.
      const carrier = fixture.workspace.writeText("phase-spec-review-1.json", "{}\n");
      fixture.ledger.recordRound("phase-spec", { op: "review", cycle: 1 });
      const runner = new PromptRunner();
      const lifecycle = new CliLifecycle({
        scene: sceneOf(fixture),
        artifacts: new ArtifactRegistry(),
        io: new CaptureIo(),
        sync: runner,
        env: { CLAUDE_CODE_SESSION_ID: "s" },
        reviews: carrier,
      });
      await lifecycle.step()(fixFrame());
      expect(runner.calls).toHaveLength(1);

      const identity: DispatchIdentity = {
        op: "fix",
        type: "phase-spec",
        phase: "fix",
        tasks: "",
        cycle: 1,
        attempt: 1,
      };
      const { facts } = sceneFactsOf(fixture, "fix", "phase-spec");
      const reviewsPath = fixture.workspace.root.basis.relativize(carrier);
      const artifact: ArtifactSnapshot = { kind: "read", reviewsPath, read: ABSENT_SNAPSHOT };
      const values = DispatchValues.compose(identity, facts, artifact);
      expect(values.INPUT_REVIEWS).toBe(reviewsPath);
      expect(values.ROLE).toBe("docs-fix");
      // The record pair on the fix face — the second of the two faces `WAVE` and
      // `INPUT_REVIEWS` are carried by.
      expect(values).toEqual(lifecycle.valuesOf(fixFrame()));
      const prompt = new TemplateAssembler().render(values);
      expect(runner.calls[0]!.args.at(-1)!.endsWith(prompt)).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the requesting carrier's three branches — the family name's index is the cycle only
// ---------------------------------------------------------------------------

describe("RequestingCarrier — the three branches and the cycle-only index", () => {
  it("resolves the family name at the review's own recorded attempt, never the fix's", () => {
    const fixture = fixtureOf();
    try {
      fixture.ledger.recordRound("1", { op: "review", cycle: 1, attempt: 1 });
      const facts = { type: "wave" as const, key: "1", cycle: 1, tasks: "1" };
      const family = RequestingCarrier.familyPath(fixture.ledger, facts);
      expect(path.basename(family)).toBe("tasks-1-review-1.json");
      // The frame's own attempt (a fix at a2) would name a carrier the review never
      // wrote — the lookup with the attempt in the params is the wrong index, and it
      // proves the family branch does not use it.
      const withAttempt = fixture.ledger.resolveHandoffPath("review", "wave", {
        tasks: "1",
        round: 1,
        attempt: 2,
      });
      expect(path.basename(withAttempt)).toBe("tasks-1-review-1-a2.json");
      // The record branch: the record exists, but the ladder resolves no carrier on
      // disk, so the path answers null (the unrecorded face, never a guess).
      expect(RequestingCarrier.requesterRecord(fixture.ledger, facts)?.attempt).toBe(1);
      expect(RequestingCarrier.path(fixture.ledger, null, facts)).toBeNull();
      // With the carrier on disk, the record branch answers that file — one rule, two
      // facts, never a second derivation.
      const written = fixture.workspace.writeText("tasks-1-review-1.json", "{}\n");
      expect(RequestingCarrier.path(fixture.ledger, null, facts)).toBe(written);
    } finally {
      fixture.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// the priority shift — the gate's row outranks the line's
// ---------------------------------------------------------------------------

/** A wave line request whose line leg refuses with `split` (the requested set is not the
 *  open wave: task 2 depends on task 1, so the open batch is `{1}`) — the line refusal
 *  the structure leg must outrank. */
const splitRequest = (fixture: Fixture, structure: PreFlightVerdict): DispatchRequest => {
  const planAbs = path.join(fixture.repo, "docs/kairos/plans/x-p40.md");
  const graph = new TaskGraph(
    new PlanDocType("plan").parse(readFileSync(planAbs, "utf8").split("\n")),
  );
  return {
    verb: "implement",
    type: "wave",
    structure,
    line: {
      ledger: fixture.ledger,
      words: new Words(),
      graph,
      tasks: new Set([1, 2]),
      lineKey: null,
      doc: null,
      pipeline: {
        specType: "phase-spec",
        specPath: "docs/kairos/specs/x-p40-design.md",
        planPath: planAbs,
        plan: planSourceOf(fixture.workspace.root.basis).readPath("docs/kairos/plans/x-p40.md"),
      },
      docClassOf: () => "wave",
    },
  };
};

describe("the priority shift — the structure rows sit ahead of the line leg", () => {
  it("stands the four rows down where a wave dispatch has no batch — the line leg answers", async () => {
    const fixture = fixtureOf();
    try {
      // The plan's only wave is closed: the predicted batch is the open frontier, which is
      // empty — so the record carries neither `WAVE` nor `INPUT_WAVE_BRIEF`. Both cells
      // are the engine's own derivation (`DispatchIdentity.tasks`), never an input the
      // orchestrator could supply, so refusing on their emptiness would mask the real
      // answer: the line leg's `split` (the plan has no open wave to dispatch).
      const values = waveValuesOf({ WAVE: "", INPUT_WAVE_BRIEF: "" });
      const verdict = await preflightOf().vet(
        waveCtxOf(fixture, { values, declarations: new TemplateAssembler().layoutOf(values) }),
      );
      expect(verdict.ok).toBe(true);
      // The four pre-dispatch rows never ran: there is no input face to judge.
      expect(verdict.order).toEqual(["tree-clean", "in-flight", "graph", "plan-ledger"]);
      expect(new DispatchAuthority().structureRefusal(verdict)).toBeNull();
      // …and the same dispatch then reaches the line leg, which owns the refusal.
      const line = new DispatchAuthority().verdict(splitRequest(fixture, verdict));
      expect(line.allowed).toBe(false);
      if (line.allowed) throw new Error("expected a line refusal");
      expect(line.leg).toBe("line");
      expect(line.reason).toBe("split");
    } finally {
      fixture.cleanup();
    }
  });

  it("reports the gate's row while both legs are broken, and the line's row once it clears", async () => {
    const fixture = fixtureOf();
    try {
      // Dirty the tree: the structure leg refuses on its FIRST row.
      writeFileSync(path.join(fixture.repo, "dirty.txt"), "dirty\n", "utf8");
      const refused = await preflightOf().vet(waveCtxOf(fixture));
      expect(refused.gate).toBe("tree-clean");
      const both = new DispatchAuthority().verdict(splitRequest(fixture, refused));
      expect(both.allowed).toBe(false);
      if (both.allowed) throw new Error("expected a refusal");
      expect(both.leg).toBe("structure");
      expect(both.reason).toBe("tree-clean");

      // Clear the gate: the same request now reaches the line leg and reports its row.
      rmSync(path.join(fixture.repo, "dirty.txt"), { force: true });
      const passed = await preflightOf().vet(waveCtxOf(fixture));
      expect(passed.ok).toBe(true);
      expect(passed.order).toEqual([
        "tree-clean",
        "in-flight",
        "graph",
        "plan-ledger",
        ...FOUR_ROWS,
      ]);
      const line = new DispatchAuthority().verdict(splitRequest(fixture, passed));
      expect(line.allowed).toBe(false);
      if (line.allowed) throw new Error("expected a line refusal");
      expect(line.leg).toBe("line");
      expect(line.reason).toBe("split");
    } finally {
      fixture.cleanup();
    }
  });
});
