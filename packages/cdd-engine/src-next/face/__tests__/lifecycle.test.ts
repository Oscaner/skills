// packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts
// P30 T2 — the implement criterion's two verification provider cells, filled by the
// lifecycle (design spec §2.4): `emptyFileTasks` from the PLAN's `Files` declarations
// and `evidenceOk` from the evidence judgment the same round already runs.
//
// The pins are the FILL, not the branch (the branch's own matrix lives in
// `contract/__tests__/completion-criterion.test.ts`):
//   · the cells are filled from the plan document and the evidence gate — a round
//     whose every task declares an empty `Files` and whose evidence is green reads as
//     a verification wave and concludes;
//   · the SAME fixture with the evidence gate red (no evidence file) stays BLOCKED —
//     the cell is wired to the real gate, never hardcoded;
//   · a wave with any non-empty `Files` row keeps the `committed nothing` refusal —
//     the OR branch never widens into "some task declares no files".
//
// Fixtures are hermetic mkdtemp repos (git-inited: the dispatch baseline is the seed
// commit, so a round that commits nothing has a real baseline to be judged against).

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  type CompletionContext,
  CompletionCriteria,
  IMPLEMENT_CARRIER_ABSENT,
  IMPLEMENT_VERIFICATION_WAVE,
} from "../../contract/completion-criterion.ts";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../../session/ledger.ts";
import type { DispatchOutcome, OpenFrame } from "../../session/run.ts";
import { type CliIo, CliLifecycle, type DispatchScene } from "../lifecycle.ts";
import type { ChildOutcome, ChildRun, ChildRunner } from "../termination.ts";

class CaptureIo implements CliIo {
  stdoutText = "";
  stderrText = "";
  stdout(text: string): void {
    this.stdoutText += text;
  }
  stderr(text: string): void {
    this.stderrText += text;
  }
}

/** The child stand-in — exits 0 without writing anything. The implement round's
 *  conclusion comes from the criterion, so a silent child is the honest fixture: no
 *  commit, no handoff draft, and no evidence unless the case writes one. */
class SilentRunner implements ChildRunner {
  calls: ChildRun[] = [];
  async run(run: ChildRun): Promise<ChildOutcome> {
    this.calls.push(run);
    return { code: 0, stdout: "", stderr: "", termination: null };
  }
}

/** A schema-shaped evidence file — the gate's green side. */
const EVIDENCE = {
  command: "pnpm run validate",
  exit_code: 0,
  passed: true,
  warnings_count: 0,
  typecheck: { command: "tsc --noEmit", exit_code: 0, passed: true },
};

/** One plan task block — `files` empty = the `Files` section declares no path. */
const taskBlock = (id: number, files: readonly string[]): string =>
  [
    `### Task ${id}: task ${id}`,
    "",
    "#### Objective",
    `objective ${id}`,
    "",
    "#### Files",
    ...files,
    "",
    "#### DependsOn",
    id === 1 ? "none" : "1",
    "",
  ].join("\n");

/** A plan document over the given task declarations. */
const planDoc = (tasks: readonly (readonly [number, readonly string[]])[]): string =>
  [
    "---",
    "doc-type: plan",
    "version: v0.1",
    "---",
    "",
    ...tasks.map(([id, files]) => taskBlock(id, files)),
  ].join("\n");

/** The change-carrying `Files` row — a wave that names a changed file is never a
 *  verification wave. */
const CHANGE_ROW = "- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`";

interface Fixture {
  readonly scene: DispatchScene;
  readonly io: CaptureIo;
  readonly cleanup: () => void;
}

/** A hermetic repo + workspace: the plan document, one seed commit (the dispatch
 *  baseline) and the ledger. `.kairos` stays out of the tree, so the round's own
 *  writes never dirty it. */
const fixture = (plan: string): Fixture => {
  const repoRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "lifecycle-")));
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "lifecycle@test"],
    ["config", "user.name", "lifecycle-test"],
  ]) {
    spawnSync("git", args, { cwd: repoRoot });
  }
  writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n", "utf8");
  writeFileSync(path.join(repoRoot, "seed.txt"), "seed\n", "utf8");
  const planPath = path.join(repoRoot, "docs", "kairos", "plans", "p30.md");
  mkdirSync(path.dirname(planPath), { recursive: true });
  writeFileSync(planPath, plan, "utf8");
  spawnSync("git", ["add", "-A"], { cwd: repoRoot });
  spawnSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });
  const workspace = new Workspace(new WorkspaceRoot(repoRoot, ".kairos/cdd"), "p30").ensure();
  const ledger = new Ledger(workspace, new ConfigLoader());
  return {
    scene: { workspace, ledger, planPath, briefPath: null },
    io: new CaptureIo(),
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
};

/** The wave implement frame of a wave key (`"1"` · `"1,2"`). */
const waveFrame = (key: string): OpenFrame => ({
  type: "wave",
  phase: "implement",
  round: 1,
  target: { kind: "wave", tasks: key.split(",").map(Number) },
  params: { tasks: key },
  key,
});

/** Write the round's canonical evidence file at the wave's own name. */
const writeEvidence = (f: Fixture, key: string): void => {
  writeFileSync(
    path.join(f.scene.workspace.path, `tasks-${key}-test-evidence.json`),
    JSON.stringify(EVIDENCE),
    "utf8",
  );
};

/** Run one dispatch, handing back its outcome plus every context the criterion judged
 *  (the spy delegates to the REAL criterion, so the outcome stays the production one). */
const dispatch = async (
  f: Fixture,
  key: string,
): Promise<{ seen: readonly CompletionContext[]; outcome: DispatchOutcome }> => {
  const seen: CompletionContext[] = [];
  const original = CompletionCriteria.of.bind(CompletionCriteria);
  const spy = vi.spyOn(CompletionCriteria, "of").mockImplementation((op) => {
    const criterion = original(op);
    return {
      judge: async (ctx: CompletionContext) => {
        seen.push(ctx);
        return criterion.judge(ctx);
      },
    };
  });
  try {
    const lifecycle = new CliLifecycle({
      scene: f.scene,
      io: f.io,
      sync: new SilentRunner(),
      env: { CLAUDE_CODE_SESSION_ID: "s" },
    });
    return { seen, outcome: await lifecycle.step()(waveFrame(key)) };
  } finally {
    spy.mockRestore();
  }
};

const messagesOf = (outcome: DispatchOutcome): readonly string[] =>
  (outcome.violations ?? []).map((violation) => violation.message);

const gradesOf = (outcome: DispatchOutcome): readonly string[] =>
  (outcome.violations ?? []).map((violation) => violation.grade);

describe("CliLifecycle — the verification provider cells (P30 §2.4)", () => {
  it("fills `emptyFileTasks` from the plan's `Files` rows and `evidenceOk` from the evidence gate", async () => {
    const f = fixture(
      planDoc([
        [1, []],
        [2, [CHANGE_ROW]],
      ]),
    );
    try {
      writeEvidence(f, "1,2");
      const { seen } = await dispatch(f, "1,2");
      expect(seen).toHaveLength(1);
      // Membership only: the plan's change-free task id, never the wave's whole set.
      expect([...(seen[0]?.emptyFileTasks ?? [])]).toEqual([1]);
      // The wave key the criterion reads its member face from — never the cell's own.
      expect(seen[0]?.row.wave).toBe("1,2");
      expect(seen[0]?.evidenceOk).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it("a verification wave's zero-commit round concludes on its green evidence, booked soft", async () => {
    const f = fixture(
      planDoc([
        [1, []],
        [2, []],
      ]),
    );
    try {
      writeEvidence(f, "1,2");
      const { outcome } = await dispatch(f, "1,2");
      expect(outcome.status).toBe("APPROVED");
      // Two bookkeeping rows, zero gates: the verification-wave fact and the absent
      // handoff draft (the silent child wrote none) — neither is a failure.
      expect(gradesOf(outcome)).toEqual(["soft", "soft"]);
      expect(messagesOf(outcome)).toEqual([IMPLEMENT_VERIFICATION_WAVE, IMPLEMENT_CARRIER_ABSENT]);
      expect(f.io.stderrText).not.toContain("CDD_BLOCKED");
    } finally {
      f.cleanup();
    }
  });

  it("the same verification fixture with the evidence gate RED stays BLOCKED — the cell is the real gate", async () => {
    const f = fixture(
      planDoc([
        [1, []],
        [2, []],
      ]),
    );
    try {
      // no evidence file at all
      const { seen, outcome } = await dispatch(f, "1,2");
      expect(seen[0]?.evidenceOk).toBe(false);
      expect(outcome.status).toBe("BLOCKED");
      expect(gradesOf(outcome)).toEqual(["hard", "hard"]);
      expect(messagesOf(outcome)[0]).toContain("test evidence is not green");
      expect(messagesOf(outcome)[1]).toContain("the test evidence at");
    } finally {
      f.cleanup();
    }
  });

  it("a wave with one non-empty `Files` row keeps the `committed nothing` refusal", async () => {
    const f = fixture(
      planDoc([
        [1, []],
        [2, [CHANGE_ROW]],
      ]),
    );
    try {
      writeEvidence(f, "1,2");
      const { outcome } = await dispatch(f, "1,2");
      expect(outcome.status).toBe("BLOCKED");
      expect(messagesOf(outcome)[0]).toContain("committed nothing since its baseline");
      expect(f.io.stderrText).toContain("CDD_BLOCKED");
    } finally {
      f.cleanup();
    }
  });
});
