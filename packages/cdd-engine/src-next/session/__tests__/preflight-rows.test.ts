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
import { ClosedDocument } from "../../contract/closed-document.ts";
import { PlanDocType } from "../../contract/doc.ts";
import {
  type DocFs,
  type FindingDraft,
  Invariant,
  type JudgeContext,
  NodeFs,
} from "../../contract/invariants.ts";
import { Contract } from "../../contract/judge.ts";
import type { ArtifactSnapshot, ArtifactSnapshotRead } from "../../contract/preflight-rows.ts";
import type { DocKey } from "../../contract/project.ts";
import type { DocRuleDeclaration } from "../../contract/rules.ts";
import type { TargetType } from "../../contract/target-type.ts";
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
import { SlugIndex } from "../../infra/slug-index.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { TemplateAssembler } from "../../render/templates.ts";
import { HandoffSchema } from "../../session/handoff-schema.ts";
import type { DispatchRequest } from "../dispatch-authority.ts";
import { DispatchAuthority } from "../dispatch-authority.ts";
import { TaskGraph } from "../graph.ts";
import { InFlight, type InFlightRecord } from "../inflight.ts";
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
  it("renders the wave prompt from the ONE record the composition root injected (WAVE included)", async () => {
    const fixture = fixtureOf();
    try {
      const runner = new PromptRunner();
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
      const lifecycle = new CliLifecycle({
        contract: new Contract(),
        scene: sceneOf(fixture),
        artifacts: new ArtifactRegistry(),
        io: new CaptureIo(),
        sync: runner,
        host: "claude",
        values,
      });
      await lifecycle.step()(waveFrame());
      expect(runner.calls).toHaveLength(1);
      expect(values.WAVE).toBe("1");
      // The renderer holds the injected record ITSELF (P40 T5): not an equal copy — the
      // one object. `toEqual` here would be a tautology once the body reads the field, so
      // the assertion is identity, and this pair is the only witness that the values have
      // ONE production point.
      expect(lifecycle.valuesOf(waveFrame())).toBe(values);
      const prompt = new TemplateAssembler().render(values);
      // The child's ONE positional is the prompt with the host's skill-ref prefix in
      // front of it; the PREFIX is the host channel's, the prompt bytes are the values'.
      expect(runner.calls[0]!.args.at(-1)!.endsWith(prompt)).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("renders the fix prompt from the ONE record the composition root injected (INPUT_REVIEWS included)", async () => {
    const fixture = fixtureOf();
    try {
      const specDoc = path.join(fixture.repo, "docs", "k", "s.md");
      mkdirSync(path.dirname(specDoc), { recursive: true });
      writeFileSync(specDoc, "# doc\n", "utf8");
      // The requesting review round: one recorded review carrier on disk.
      const carrier = fixture.workspace.writeText("phase-spec-review-1.json", "{}\n");
      fixture.ledger.recordRound("phase-spec", { op: "review", cycle: 1 });
      const runner = new PromptRunner();
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
      const lifecycle = new CliLifecycle({
        contract: new Contract(),
        scene: sceneOf(fixture),
        artifacts: new ArtifactRegistry(),
        io: new CaptureIo(),
        sync: runner,
        host: "claude",
        reviews: carrier,
        values,
      });
      await lifecycle.step()(fixFrame());
      expect(runner.calls).toHaveLength(1);
      expect(values.INPUT_REVIEWS).toBe(reviewsPath);
      expect(values.ROLE).toBe("docs-fix");
      // The record pair on the fix face — the second of the two faces `WAVE` and
      // `INPUT_REVIEWS` are carried by. ONE object, not two equal ones.
      expect(lifecycle.valuesOf(fixFrame())).toBe(values);
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

// ---------------------------------------------------------------------------
// P41 T5 — the tiers' rendering, the closed-document exemption and the closure port
// ---------------------------------------------------------------------------

/** A declaration-shaped marker strategy — it reports ONCE when the judged body carries
 *  the row's own marker, so an arm can place one violation of a NAMED declaration and
 *  read that declaration's `checked:` row. The tier and the exemption ride the
 *  declaration, never the strategy. */
class MarkerInvariant extends Invariant {
  readonly name: string;
  readonly #marker: string;

  constructor(name: string, marker: string) {
    super();
    this.name = name;
    this.#marker = marker;
  }

  evaluate(ctx: JudgeContext): FindingDraft[] {
    if (!ctx.text.includes(this.#marker)) return [];
    return [this.finding(ctx, "body", `${this.#marker} reported`, "drop the marker")];
  }
}

/** One doc-scope test declaration over a marker. */
const markerRow = (
  id: string,
  marker: string,
  severity: "block" | "warn",
  skipWhenClosed: boolean,
): DocRuleDeclaration => ({
  scope: "doc",
  id,
  docKeys: "all",
  severity,
  seat: ["dispatch", "close"],
  skipWhenClosed,
  create: () => new MarkerInvariant(id, marker),
});

/** The fixture's shape rows' ids — the closed-document exemption's subject (the arms
 *  below read all of them; the real roster lives in the phase spec's §4.2). */
const SHAPE_ROW_IDS = [
  "shape-one",
  "shape-two",
  "shape-three",
  "shape-four",
  "shape-five",
  "shape-six",
] as const;

/** The test registry — one open `warn` row, one open `block` row and the six closed-
 *  exempt shape rows. The shape rows' tier is the parameter: the rendering arm wants
 *  `warn` (the `warned` byte), the single-spec arm wants `block` (the `failed` byte),
 *  and the render reads the SAME declarations the judgment stamped. */
const shapeRegistryOf = (shapeSeverity: "block" | "warn"): readonly DocRuleDeclaration[] => [
  markerRow("open-warn", "WARN_HIT", "warn", false),
  markerRow("open-block", "BLOCK_HIT", "block", false),
  ...SHAPE_ROW_IDS.map((id) => markerRow(id, "SHAPE_HIT", shapeSeverity, true)),
];

/** The existence-permissive seam — the four pre-dispatch rows read declared paths'
 *  existence, and these arms judge the doc gate over real fixture documents. Reads and
 *  listings stay real, so the doc-contract judgment sees the bytes on disk. */
class RealReadsFs implements DocFs {
  readonly #real = new NodeFs();

  exists(): boolean {
    return true;
  }

  read(p: string): string | null {
    return this.#real.read(p);
  }

  list(p: string): readonly string[] {
    return this.#real.list(p);
  }
}

/** The seam under judgment — the injected test registry, the real files, and the
 *  closure port (absent arms prove nothing closed, as the production default does). */
const shapeSeamOf = (
  registry: readonly DocRuleDeclaration[],
  provenClosed?: (rel: string) => boolean,
): PreFlight =>
  new PreFlight({
    git: new GitClient(),
    contract: new Contract(registry),
    words: new Words(),
    fs: new RealReadsFs(),
    provenClosed,
  });

/** Write one document into the fixture repo and commit it (the gate reads a clean tree). */
const writeDoc = (repo: string, rel: string, content: string): void => {
  const absolute = path.join(repo, rel);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
  commitAll(repo);
};

/** A judged document's literal — the minimal declared head the doc gate reads. */
const judgedDoc = (
  docType: "phase-spec" | "plan" | "single-spec",
  slug: string,
  body: readonly string[],
): string =>
  [
    "---",
    "title: Shape Doc",
    `doc-type: ${docType}`,
    "version: v0.1",
    "date: 2026-11-20",
    `slug: ${slug}`,
    "---",
    "",
    ...body,
  ].join("\n");

/** An overall charter whose Phase-inventory row carries the two NAMED cells — the
 *  closure registration the gate reads. Either cell may be `[Pending]`. */
const charterOf = (slug: string, designCell: string, planCell: string): string =>
  [
    "---",
    "title: Shape Charter",
    "doc-type: overall",
    "version: v1.0",
    "date: 2026-11-20",
    `slug: ${slug}`,
    "---",
    "",
    "## Phase inventory",
    "",
    "| Phase | Scope | Design spec | Implementation plan | Dependency |",
    "|---|---|---|---|---|",
    `| P1 | scope | ${designCell} | ${planCell} | none |`,
    "",
  ].join("\n");

/** A `✔ Done` cell naming one file (the full-width parentheses the grammar reads). */
const doneCell = (file: string): string => `✔ Done（\`${file}\` · 2026-11-20）`;

/** The doc-face context of one fixture — every pre-dispatch cell supplied, the two
 *  judged path cells pointing at real files. */
const docFaceCtxOf = (
  fixture: Fixture,
  parts: { readonly type: TargetType; readonly docKey: DocKey; readonly rel: string },
): PreFlightContext => {
  const values: Record<string, string> = {
    ROLE: "review",
    TARGET_TYPE: parts.type,
    INPUT_SPEC: parts.rel,
    INPUT_PLAN: "docs/kairos/plans/x-p40.md",
    INPUT_OVERALL: "docs/kairos/overalls/x-charter.md",
    INPUT_WAVE_BRIEF: "tasks-1-brief.md",
    INPUT_REVIEWS: "carrier.json",
    INPUT_RULINGS: "rulings.json",
    BASE_BRANCH: "develop",
    OUTPUT_REPORT: "report.md",
    OUTPUT_EVIDENCE: "evidence.json",
    OUTPUT_HANDOFF: "handoff.json",
    WORKSPACE_DIR: ".kairos/cdd/p40-slug",
    WORKSPACE_ID: "p40-slug",
  };
  return {
    type: parts.type,
    repoRoot: fixture.repo,
    plan: planSourceOf(fixture.workspace.root.basis).readPath("docs/kairos/plans/x-p40.md"),
    ledger: fixture.ledger,
    doc: { docKey: parts.docKey, path: parts.rel as RepoPath },
    inflight: new InFlight(fixture.workspace.root, fixture.workspace.slug, {
      live: async () => false,
    }),
    host: "claude",
    values,
    declarations: new TemplateAssembler().layoutOf(values),
    scene: { program: false, docType: true },
    artifact: ABSENT_ARTIFACT,
  };
};

describe("PreFlight — the shape tiers and the closed-document exemption (P41 T5)", () => {
  it("renders each row by its own declaration: passed, warned and failed in one judgment", async () => {
    const fixture = fixtureOf();
    try {
      const rel = "docs/kairos/specs/x-shape-design.md";
      writeDoc(
        fixture.repo,
        rel,
        judgedDoc("phase-spec", "x-shape", ["## Design", "", "WARN_HIT"]),
      );
      const verdict = await shapeSeamOf(shapeRegistryOf("warn")).vet(
        docFaceCtxOf(fixture, { type: "phase-spec", docKey: "phase-spec", rel }),
      );
      // A `warn` hit reports and the dispatch proceeds — the refusal needs a block.
      expect(verdict.ok).toBe(true);
      expect(verdict.checked).toContain("open-warn: warned — 1 warning(s)");
      expect(verdict.checked).toContain("open-block: passed");
      expect(verdict.checked).toContain("shape-one: passed");
      // The ledger rows are absent from this registry's declaration set: one list, one
      // render — a rule that never ran has no row.
      expect(verdict.checked.some((row) => row.startsWith("closed-wave"))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("refuses on a block hit and lists only the blocking finding under `details`", async () => {
    const fixture = fixtureOf();
    try {
      const rel = "docs/kairos/specs/x-shape-design.md";
      writeDoc(
        fixture.repo,
        rel,
        judgedDoc("phase-spec", "x-shape", ["## Design", "", "WARN_HIT", "", "BLOCK_HIT"]),
      );
      // An overall that names nobody: a registration exists, so the closure-absence row
      // is out of scope here and `details` holds the blocking findings alone.
      writeDoc(
        fixture.repo,
        "docs/kairos/overalls/x-charter.md",
        charterOf("x-charter", "[Pending]", "[Pending]"),
      );
      const verdict = await shapeSeamOf(shapeRegistryOf("warn")).vet(
        docFaceCtxOf(fixture, { type: "phase-spec", docKey: "phase-spec", rel }),
      );
      expect(verdict.ok).toBe(false);
      expect(verdict.gate).toBe("doc-contract");
      // The warn row still reads its own tier — the refusal is graded by severity, not by
      // "some finding exists".
      expect(verdict.checked).toContain("open-warn: warned — 1 warning(s)");
      expect(verdict.checked).toContain("open-block: failed");
      // Exactly one detail row: the block finding. A warning beside a real stop would
      // send the reader to repair a line that was never the reason.
      expect(verdict.details).toHaveLength(1);
      expect(verdict.details?.[0]).toContain("open-block@body:");
      expect(verdict.details?.some((row) => row.includes("open-warn"))).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("skips exactly the exempt rows on a closed document, and still reports the open rows", async () => {
    const fixture = fixtureOf();
    try {
      const rel = "docs/kairos/specs/x-shape-design.md";
      writeDoc(
        fixture.repo,
        rel,
        judgedDoc("phase-spec", "x-shape", ["## Design", "", "WARN_HIT", "", "SHAPE_HIT"]),
      );
      writeDoc(
        fixture.repo,
        "docs/kairos/overalls/x-charter.md",
        charterOf("x-charter", doneCell("x-shape-design.md"), "[Pending]"),
      );
      const closed = new ClosedDocument(SlugIndex.build(fixture.repo));
      const verdict = await shapeSeamOf(shapeRegistryOf("warn"), (target) =>
        closed.closed(target),
      ).vet(docFaceCtxOf(fixture, { type: "phase-spec", docKey: "phase-spec", rel }));
      expect(verdict.ok).toBe(true);
      // The six shape rows never ran: `passed` would testify for a rule that judged
      // nothing, so the exemption is named.
      for (const id of SHAPE_ROW_IDS) {
        expect(verdict.checked).toContain(`${id}: skipped (closed document)`);
      }
      // Closure exempts those six and ONLY those: the open rows judged the same body.
      expect(verdict.checked).toContain("open-warn: warned — 1 warning(s)");
      expect(verdict.checked).toContain("open-block: passed");
    } finally {
      fixture.cleanup();
    }
  });

  it("still refuses a non-exempt violation on a closed document", async () => {
    const fixture = fixtureOf();
    try {
      const rel = "docs/kairos/specs/x-shape-design.md";
      writeDoc(
        fixture.repo,
        rel,
        judgedDoc("phase-spec", "x-shape", ["## Design", "", "BLOCK_HIT", "", "SHAPE_HIT"]),
      );
      writeDoc(
        fixture.repo,
        "docs/kairos/overalls/x-charter.md",
        charterOf("x-charter", "[Pending]", doneCell("x-shape-design.md")),
      );
      const closed = new ClosedDocument(SlugIndex.build(fixture.repo));
      const verdict = await shapeSeamOf(shapeRegistryOf("warn"), (target) =>
        closed.closed(target),
      ).vet(docFaceCtxOf(fixture, { type: "phase-spec", docKey: "phase-spec", rel }));
      expect(verdict.ok).toBe(false);
      expect(verdict.checked).toContain("open-block: failed");
      expect(verdict.checked).toContain("shape-one: skipped (closed document)");
    } finally {
      fixture.cleanup();
    }
  });

  it("adds the closure row only when the tree registers NO overall charter", async () => {
    const noCharter = fixtureOf();
    const charterWithoutNaming = fixtureOf();
    try {
      const rel = "docs/kairos/specs/x-shape-design.md";
      writeDoc(
        noCharter.repo,
        rel,
        judgedDoc("phase-spec", "x-shape", ["## Design", "", "BLOCK_HIT"]),
      );
      const absent = await shapeSeamOf(shapeRegistryOf("warn")).vet(
        docFaceCtxOf(noCharter, { type: "phase-spec", docKey: "phase-spec", rel }),
      );
      expect(absent.ok).toBe(false);
      // Closure is unprovable here — not merely unproven — and the refusal says so.
      expect(absent.details).toContain(new Words().preflightWords().closureUnavailable);

      writeDoc(
        charterWithoutNaming.repo,
        rel,
        judgedDoc("phase-spec", "x-shape", ["## Design", "", "BLOCK_HIT"]),
      );
      // An overall that names nobody is the "unproven" case: a registration exists, so
      // the absence row would misdescribe it.
      writeDoc(
        charterWithoutNaming.repo,
        "docs/kairos/overalls/x-charter.md",
        charterOf("x-charter", "[Pending]", "[Pending]"),
      );
      const unproven = await shapeSeamOf(shapeRegistryOf("warn")).vet(
        docFaceCtxOf(charterWithoutNaming, {
          type: "phase-spec",
          docKey: "phase-spec",
          rel,
        }),
      );
      expect(unproven.ok).toBe(false);
      expect(unproven.details).not.toContain(new Words().preflightWords().closureUnavailable);
    } finally {
      noCharter.cleanup();
      charterWithoutNaming.cleanup();
    }
  });

  it("reads `skipped (no doc target)` by dispatch type, not by a missing `--spec`", async () => {
    const fixture = fixtureOf();
    try {
      const rel = "docs/kairos/plans/x-shape.md";
      writeDoc(
        fixture.repo,
        rel,
        judgedDoc("plan", "x-shape", ["## Constraints", "", "BLOCK_HIT"]),
      );
      const judged = await shapeSeamOf(shapeRegistryOf("warn")).vet(
        docFaceCtxOf(fixture, { type: "plan", docKey: "plan", rel }),
      );
      // The plan face HAS a doc target, so its rows judge — the block row reads its tier.
      expect(judged.ok).toBe(false);
      expect(judged.checked).toContain("open-block: failed");
      expect(judged.checked.filter((row) => row.endsWith("skipped (no doc target)"))).toHaveLength(
        0,
      );

      // The SAME document as a wave dispatch has no doc target at all: every doc row
      // reads the skip word, and the bytes are the existing ones.
      const wave = await shapeSeamOf(shapeRegistryOf("warn")).vet(waveCtxOf(fixture));
      expect(wave.ok).toBe(true);
      const skipped = wave.checked.filter((row) => row.endsWith(": skipped (no doc target)"));
      expect(skipped).toHaveLength(8);
      expect(skipped).toContain("shape-six: skipped (no doc target)");
    } finally {
      fixture.cleanup();
    }
  });

  it("judges an unnamed single-spec and skips the shape rows once a named cell claims it", async () => {
    const fixture = fixtureOf();
    try {
      const rel = "docs/kairos/specs/x-single.md";
      const body = ["## Acceptance", "", "SHAPE_HIT", "", "WARN_HIT"];
      writeDoc(fixture.repo, rel, judgedDoc("single-spec", "x-single", body));
      const registry = shapeRegistryOf("block");
      const sealed = await shapeSeamOf(registry).vet(
        docFaceCtxOf(fixture, { type: "single-spec", docKey: "single-spec", rel }),
      );
      // No phase inventory names this file: closure is unproven, so the shape rows judge,
      // and the declared `block` tier is what the row reads.
      expect(sealed.ok).toBe(false);
      expect(sealed.checked).toContain("shape-one: failed");
      expect(sealed.checked).not.toContain("shape-one: skipped (closed document)");

      // The same bytes, named in BOTH named cells — the two faces of one registration.
      writeDoc(
        fixture.repo,
        "docs/kairos/overalls/x-charter.md",
        charterOf("x-charter", doneCell("x-single.md"), doneCell("x-single.md")),
      );
      const reader = new ClosedDocument(SlugIndex.build(fixture.repo));
      const closed = await shapeSeamOf(registry, (target) => reader.closed(target)).vet(
        docFaceCtxOf(fixture, { type: "single-spec", docKey: "single-spec", rel }),
      );
      expect(closed.ok).toBe(true);
      for (const id of SHAPE_ROW_IDS) {
        expect(closed.checked).toContain(`${id}: skipped (closed document)`);
      }
      // The other rows judged the same body — closure is not a document-wide silence.
      expect(closed.checked).toContain("open-warn: warned — 1 warning(s)");
    } finally {
      fixture.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// P44 §3.2 — the in-flight row reads one of TWO tables, chosen by the record's own
// target facts: `checked.inFlight.stale` keeps "the holder is gone, the target still
// stands", and a record whose target read out missing renders the fourth state's line
// from the `inFlight` row. The three arms below are the pair plus the two mirror
// shapes: one fact gone renders that cell alone, so neither cell speaks for a target
// the record still holds.
// ---------------------------------------------------------------------------

/** One standing in-flight record — the cells the row's judgment reads (the rest are
 *  the identity facts a record carries). */
const standingRecord = (over: Partial<InFlightRecord> = {}): InFlightRecord => ({
  pid: 4242,
  command: "cdd implement --tasks 1",
  slug: "p40-slug",
  startedAt: Date.parse("2026-10-28T10:00:00.000Z"),
  wave: "1",
  phase: "implement",
  cycle: 1,
  attempt: 1,
  briefHash: null,
  plan: "docs/kairos/plans/x-p40.md",
  dispatchBase: null,
  sampledAt: null,
  verdict: null,
  ...over,
});

describe("the in-flight row — the fourth state reads the OTHER table (P44 §3.2)", () => {
  /** Plant one stale record and answer the verdict's `in-flight:` row (the gate
   *  passes it under `--recover`, so the row is what this case reads). */
  const staleRowOf = async (
    fixture: Fixture,
    record: InFlightRecord,
  ): Promise<{ row: string; verdict: PreFlightVerdict }> => {
    const dir = path.join(fixture.repo, ".kairos", "cdd");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "in-flight.json"), JSON.stringify(record, null, 2), "utf8");
    const verdict = await preflightOf().vet({ ...waveCtxOf(fixture), recover: true });
    return { row: verdict.checked.find((row) => row.startsWith("in-flight:")) ?? "", verdict };
  };

  it("keeps the ordinary stale row while both target facts stand", async () => {
    const fixture = fixtureOf();
    try {
      const { row, verdict } = await staleRowOf(fixture, standingRecord());
      expect(verdict.ok).toBe(true);
      expect(row).toBe("in-flight: stale holder — pid 4242 (re-run with --recover to take over)");
    } finally {
      fixture.cleanup();
    }
  });

  it("renders both clauses when both target facts read out missing", async () => {
    const fixture = fixtureOf();
    try {
      const { row } = await staleRowOf(
        fixture,
        standingRecord({ plan: "docs/kairos/plans/gone.md", slug: "gone-slug" }),
      );
      expect(row).toBe(
        "in-flight: the dispatch's target is gone — the plan the record names is not on this tree · the record's workspace directory is not on this tree — re-run the same command with --recover to take the in-flight record over",
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("renders the plan clause alone when only the plan is gone (the workspace still stands)", async () => {
    const fixture = fixtureOf();
    try {
      const { row } = await staleRowOf(
        fixture,
        standingRecord({ plan: "docs/kairos/plans/gone.md" }),
      );
      expect(row).toBe(
        "in-flight: the dispatch's target is gone — the plan the record names is not on this tree — re-run the same command with --recover to take the in-flight record over",
      );
      expect(row).not.toContain("workspace directory");
    } finally {
      fixture.cleanup();
    }
  });

  it("renders the workspace clause alone when only the directory is gone (the plan still stands)", async () => {
    const fixture = fixtureOf();
    try {
      const { row } = await staleRowOf(fixture, standingRecord({ slug: "gone-slug" }));
      expect(row).toBe(
        "in-flight: the dispatch's target is gone — the record's workspace directory is not on this tree — re-run the same command with --recover to take the in-flight record over",
      );
      expect(row).not.toContain("the plan the record names");
    } finally {
      fixture.cleanup();
    }
  });

  it("renders the workspace clause alone for a record that carries no plan fact", async () => {
    const fixture = fixtureOf();
    try {
      // A `--spec` dispatch's record carries `plan: null`, so only one fact exists to
      // read — and the plan cell never speaks for a fact the record does not have.
      const { row } = await staleRowOf(fixture, standingRecord({ plan: null, slug: "gone-slug" }));
      expect(row).toContain("the record's workspace directory is not on this tree");
      expect(row).not.toContain("the plan the record names");
    } finally {
      fixture.cleanup();
    }
  });
});
