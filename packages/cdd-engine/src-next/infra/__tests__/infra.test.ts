// packages/cdd-engine/src-next/infra/__tests__/infra.test.ts
// T12 infra suite + T21 typed-plane migration + T2 declaration convergence:
//   · runtime — the typed engine-config surface (version + the handoff namespace:
//     workspace-root segment + the family naming table — the argv channel table's
//     home is the CLI declaration single surface, face/declare.ts §2.4), single-source
//     asserts (the data lives in the typed modules — zero config-home reads);
//   · config — the ConfigLoader typed accessor facade (the consumer surface the
//     retired loader kept: engineConfig / harnessContract / templateContract /
//     handoffNamespace — now the typed planes' single home);
//   · git — the single git seam over a real temp repo;
//   · workspace — the root/workspace pair + the slug rule + the JSON read/write.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARGV_CHANNEL } from "../../face/declare.ts";
import { DISPATCH, HOSTS, REFS } from "../../face/host.ts";
import { REVIEWS, TEMPLATE_PROMPT } from "../../render/templates.ts";
import { HandoffSchema } from "../../session/handoff-schema.ts";
import { ConfigLoader } from "../config.ts";
import { GitClient } from "../git.ts";
import { ENGINE_RUNTIME, HANDOFF_FAMILIES } from "../runtime.ts";
import { Workspace, WorkspaceRoot } from "../workspace.ts";

describe("runtime — the typed engine-config surface (the typed data plane)", () => {
  it("carries the engine runtime facts — version, the argv channel, the handoff namespace", () => {
    expect(ENGINE_RUNTIME.$version).toBeGreaterThanOrEqual(1);
    expect(ENGINE_RUNTIME.handoffNamespace.workspaceRoot).toBe(".kairos/cdd");
    // The CLI channel table — the flag/type/enum single source (tasks / type enum),
    // single-homed at the CLI declaration surface (face/declare.ts §2.4 — moved
    // from this plane by the T2 declaration convergence), with the flag-level
    // `help` row the commander Options face reads (Task 4).
    expect(ARGV_CHANNEL.tasks).toEqual({
      flag: "--tasks",
      type: "int-list",
      help: "the task ids of the wave group (comma-separated)",
    });
    expect(ARGV_CHANNEL.type.values).toEqual(["wave", "branch", "spec", "plan"]);
    expect(ARGV_CHANNEL.help).toEqual({
      flag: "--help",
      alias: "-h",
      type: "bool",
      scope: "program",
      help: "show this help",
    });
  });

  it("carries the handoff family naming table — every op.type the ledger resolves", () => {
    expect(HANDOFF_FAMILIES["implement.wave"].name).toBe("tasks-{tasks}-implement.json");
    expect(HANDOFF_FAMILIES["review.wave"].name).toBe("tasks-{tasks}-review-{round}.json");
    // Each family is a pure name row — the carrier plane is derived from the op
    // (`HandoffSchema.planeOf`), never declared per family. The return-format field is
    // gone (RETURN_PROSE is the ONE return contract).
    expect(HandoffSchema.planeOf("review")).toBe("judge");
    expect(HandoffSchema.planeOf("implement")).toBe("work");
    expect(HandoffSchema.planeOf("fix")).toBe("work");
    for (const key of [
      "implement.wave",
      "review.wave",
      "fix.wave",
      "review.spec",
      "fix.spec",
      "review.plan",
      "fix.plan",
      "review.branch",
      "fix.branch",
    ] as const satisfies readonly (keyof typeof HANDOFF_FAMILIES)[]) {
      expect(HANDOFF_FAMILIES[key], key).toBeDefined();
      expect(Object.keys(HANDOFF_FAMILIES[key]), key).toEqual(["name"]);
    }
    // the return-format field is deleted with the divided return faces (the type-level
    // assertion — a re-added field would fail the compile)
  });

  it("declares the single-source channel/marker facts with zero duplication (host markers in host.ts only)", () => {
    // The host-marker closure derives from the harness detect rows (face/host.ts) —
    // the argv channel lives at the CLI declaration surface (face/declare.ts §2.4)
    // and carries no host marker; the marker env keys appear in no channel row
    // (single source, no second declaration).
    const argvText = JSON.stringify(ARGV_CHANNEL);
    for (const marker of ["CLAUDE_CODE_SESSION_ID", "AI_AGENT"]) {
      expect(argvText, marker).not.toContain(marker);
    }
  });
});

describe("config — the typed accessor facade (one no-I/O route per face)", () => {
  it("routes the engine-config face — the handoff namespace + version", () => {
    const loader = new ConfigLoader();
    expect(loader.handoffNamespace().workspaceRoot).toBe(".kairos/cdd");
    expect(loader.engineConfig().$version).toBeGreaterThanOrEqual(1);
  });

  it("routes the harness + template faces — the typed host contract + dispatch prompt", () => {
    const loader = new ConfigLoader();
    expect(loader.harnessContract().hosts.claude.detect.env).toBe("CLAUDE_CODE_SESSION_ID");
    expect(loader.harnessContract().hosts.claude.promptForm).toBe("ref-prefixed");
    expect(loader.harnessContract().dispatch.implement).toBe("mattpocock-skills:implement");
    expect(loader.harnessContract().refs["mattpocock-skills:code-review"].pi).toBe(
      "/skill:code-review",
    );
    const template = loader.templateContract();
    // v1.8 — the mode dispatch table (implement/fix/review/docs-fix) + the single return contract
    // (RETURN_JSON / DOCS_FIX retired) — the work-mode rows + the four review variants
    // (the review mode's ROLE resolves by REVIEW_TYPE)
    expect(Object.keys(template.modes)).toEqual(["implement", "fix", "docs-fix"]);
    expect(Object.keys(template.reviews)).toEqual(["wave", "branch", "spec", "plan"]);
    // P11 — the return zone is ONE plain-prose block (the two-line stdout contract
    // retired with the introspection that enumerated its formats)
    expect(Object.keys(template.return)).toEqual(["RETURN_PROSE"]);
  });

  it("carries the P5 review criteria — the typed dispatch rows + axes guides with zero forbidden prose", () => {
    // The task/branch dispatch rows name their ref only (the parallel-sub-agents note is deleted).
    expect(DISPATCH.review.wave).toEqual({ ref: "mattpocock-skills:code-review" });
    expect(DISPATCH.review.branch).toEqual({ ref: "mattpocock-skills:code-review" });
    // The spec/plan URC criteria migrated to the template plane's REVIEWS (v1.8
    // closeout) — their single typed home: the three axes + the writing-plans
    // self-check + the verification-evidence duty, plus the per-type lens.
    expect(REVIEWS.spec.axesGuide).toContain("completeness/consistency/clarity");
    expect(REVIEWS.spec.axesGuide).toContain("writing-plans self-check");
    expect(REVIEWS.spec.axesGuide).toContain("verification evidence");
    expect(REVIEWS.plan.axesGuide).toContain("completeness/decomposition/buildability");
    expect(REVIEWS.spec.lensEnum).toEqual(["completeness", "consistency", "clarity"]);
    // D61-5 — the spec axis carries the program conformance criterion (the phase
    // judged against the scope its charter's Phase inventory registered); the
    // completeness lens owns the verdict, so the lens set is unchanged.
    expect(REVIEWS.spec.axesGuide).toContain("program conformance");
    expect(REVIEWS.spec.axesGuide).toContain("INPUT_OVERALL");
    expect(REVIEWS.plan.lensEnum).toEqual(["completeness", "decomposition", "buildability"]);
    // The review prompts fold the criteria/lens into their fixed prefix — the
    // INPUT_CRITERIA/INPUT_LENS round-context tokens are gone (§3.7).
    expect(TEMPLATE_PROMPT.reviews.spec.shell.join("\n")).toContain("Follow URC");
    expect(TEMPLATE_PROMPT.tokens.map((t) => t.name)).not.toContain("INPUT_CRITERIA");
    // The implement slot is the M1 supersede — mattpocock-skills:implement, registered in refs.
    expect(DISPATCH.implement).toBe("mattpocock-skills:implement");
    expect(REFS["mattpocock-skills:implement"].claude).toBe("/mattpocock-skills:implement");
    expect(REFS["mattpocock-skills:implement"].pi).toBe("/skill:implement");
    // The forbidden prose is gone from every review surface.
    const reviewText = JSON.stringify({ ...DISPATCH.review, ...REVIEWS });
    expect(reviewText).not.toContain("parallel sub-agents");
    // The axes guides carry the verification-evidence duty.
    expect(REVIEWS.wave.axesGuide).toContain("dual evidence");
    expect(REVIEWS.branch.axesGuide).toContain("dual evidence");
    // P16/D60 — the axis face invariants: the single-agent fact lives in REVIEW_ITEM
    // only (the wave axis's duplicate tail sentence is retired), and the branch axis
    // carries the three judgment points a green run cannot show.
    expect(REVIEWS.wave.axesGuide).not.toContain("Single agent");
    expect(REVIEWS.branch.axesGuide).toContain("Three things a green run cannot show you");
    expect(REVIEWS.branch.axesGuide).toContain("design —");
    expect(REVIEWS.branch.axesGuide).toContain("test adequacy —");
    expect(REVIEWS.branch.axesGuide).toContain("migration —");
    expect(REVIEWS.branch.lensEnum).toEqual(["standards", "spec", "buildability"]);
    // P16/D60 — the two hard review disciplines ride REVIEW_ITEM, so all four review
    // shells carry them (the data-plane side of the render suite's assembled-face pins).
    for (const type of ["wave", "branch", "spec", "plan"] as const) {
      const shell = TEMPLATE_PROMPT.reviews[type].shell.join("\n");
      expect(shell).toContain("**Read-only:**");
      expect(shell).toContain("**Single agent:**");
    }
    expect(TEMPLATE_PROMPT.modes.implement.shell.join("\n")).toContain(
      "mattpocock-skills:implement",
    );
    // Zero $schema/_doc prose in the typed planes.
    expect(JSON.stringify(ENGINE_RUNTIME)).not.toContain("$schema");
    expect(JSON.stringify(ENGINE_RUNTIME)).not.toContain('"_doc"');
    expect(JSON.stringify(HOSTS)).not.toContain("$schema");
  });
});

describe("git — the single git seam over a real temp repo", () => {
  it("walks init → dirty → clean over one repo (fail-open)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "infra-git-"));
    try {
      const gitRun = (args: readonly string[], cwd?: string): void => {
        execFileSync("git", [...args], { cwd });
      };
      gitRun(["init", "-b", "main", dir]);
      gitRun(["config", "user.email", "tester@example.dev"], dir);
      gitRun(["config", "user.name", "Tester"], dir);
      const git = new GitClient();
      expect(await git.topLevel(dir)).toBe(realpathSync(dir));
      writeFileSync(path.join(dir, "a.txt"), "a\n");
      expect(await git.isClean(dir)).toBe(false);
      gitRun(["add", "-A"], dir);
      gitRun(["commit", "-m", "feat: initial"], dir);
      expect(await git.isClean(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails open outside a git repo (no exception crosses the seam)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "infra-nogit-"));
    try {
      const git = new GitClient();
      expect(await git.topLevel(dir)).toBeNull();
      expect(await git.isClean(dir)).toBe(false); // no repo counts dirty
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exposes exactly the four read seams — topLevel + isClean + head + commitsSince, the write seams retired (§2.1)", () => {
    // The GitClient is the engine's git READ adapter: repo-root location (topLevel),
    // working-tree cleanliness (isClean), and the crash record's two postmortem facts
    // (head — the dispatch baseline; commitsSince — what a crashed child committed).
    // The retired WRITE seams (addAll / commit) must not survive on the prototype —
    // the engine never writes a commit; it judges and records the live tree.
    const methods = Object.getOwnPropertyNames(GitClient.prototype).filter(
      (name) => name !== "constructor",
    );
    expect(methods.sort()).toEqual(["commitsSince", "head", "isClean", "topLevel"]);
  });

  it("reads the dispatch baseline (head) and the commits after it (commitsSince)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "infra-git-facts-"));
    try {
      const gitRun = (args: readonly string[]): void => {
        execFileSync("git", [...args], { cwd: dir });
      };
      gitRun(["init", "-q"]);
      gitRun(["config", "user.email", "tester@example.dev"]);
      gitRun(["config", "user.name", "Tester"]);
      const git = new GitClient();
      // No commit yet — a present fact is absent, never a fabricated ref.
      expect(await git.head(dir)).toBeNull();
      writeFileSync(path.join(dir, "a.txt"), "a\n");
      gitRun(["add", "-A"]);
      gitRun(["commit", "-q", "-m", "base"]);
      const base = await git.head(dir);
      expect(base).not.toBeNull();
      expect(await git.commitsSince(dir, base)).toEqual([]);
      writeFileSync(path.join(dir, "b.txt"), "b\n");
      gitRun(["add", "-A"]);
      gitRun(["commit", "-q", "-m", "child work"]);
      const since = await git.commitsSince(dir, base);
      expect(since.length).toBe(1);
      expect(since[0]).toBe(`${await git.head(dir)} child work`);
      // An absent base yields no range judgment (fail-open).
      expect(await git.commitsSince(dir, null)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("workspace — the root/workspace pair + the slug rule + JSON roundtrip", () => {
  it("derives paths and roundtrips JSON reads/writes under the slug dir", () => {
    const base = mkdtempSync(path.join(tmpdir(), "infra-ws-"));
    try {
      const root = new WorkspaceRoot(base, ".kairos/cdd");
      const workspace = new Workspace(root, "test-slug");
      expect(workspace.path).toBe(path.join(base, ".kairos", "cdd", "test-slug"));
      workspace.writeJson("probe.json", { a: 1 });
      expect(workspace.readJson<{ a: number }>("probe.json")).toEqual({
        kind: "ok",
        value: { a: 1 },
      });
      expect(workspace.readJson("missing.json")).toEqual({ kind: "missing" });
      expect(workspace.resolve("probe.json")).toBe(path.join(workspace.path, "probe.json"));
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("readJson is tri-state — a present-but-unparseable file reads `malformed`, never `missing` (D27)", () => {
    const base = mkdtempSync(path.join(tmpdir(), "infra-ws-"));
    try {
      const root = new WorkspaceRoot(base, ".kairos/cdd");
      const workspace = new Workspace(root, "test-slug");
      workspace.ensure();
      writeFileSync(path.join(workspace.path, "bad.json"), "{ not json", "utf8");
      // the true cause is reported: a corrupt file is a distinct fact from an absent one
      expect(workspace.readJson("bad.json")).toEqual({ kind: "malformed" });
      expect(workspace.readJson("absent.json")).toEqual({ kind: "missing" });
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("readJsonLenient tolerates the sub-agent draft dialect — trailing comma / comments (D39)", () => {
    const base = mkdtempSync(path.join(tmpdir(), "infra-ws-"));
    try {
      const root = new WorkspaceRoot(base, ".kairos/cdd");
      const workspace = new Workspace(root, "test-slug");
      workspace.ensure();
      // The W3 {5,11} block shape — a trailing comma in the draft's notes array: the
      // lenient read passes it, the strict read vetoes it (the two faces are isolated).
      const trailing = '{\n  "status": "APPROVED",\n  "notes": [\n    "a",\n    "b",\n  ]\n}\n';
      writeFileSync(path.join(workspace.path, "draft.json"), trailing, "utf8");
      expect(workspace.readJsonLenient("draft.json")).toEqual({
        kind: "ok",
        value: { status: "APPROVED", notes: ["a", "b"] },
      });
      expect(workspace.readJson("draft.json")).toEqual({ kind: "malformed" });

      // A comment is the same dialect slip — tolerated leniently, vetoed strictly.
      writeFileSync(path.join(workspace.path, "commented.json"), '{ // note\n "a": 1\n}', "utf8");
      expect(workspace.readJsonLenient("commented.json")).toEqual({ kind: "ok", value: { a: 1 } });
      expect(workspace.readJson("commented.json")).toEqual({ kind: "malformed" });

      // A REAL break stays fail-loud on both faces — leniency never swallows corruption.
      // The lenient face ALSO carries the parser's precise error codes (D39) for
      // diagnosis; the strict face reports its bare malformed outcome.
      writeFileSync(path.join(workspace.path, "broken.json"), '{ "a": 1 ', "utf8");
      const broken = workspace.readJsonLenient("broken.json");
      expect(broken.kind).toBe("malformed");
      expect(broken.kind === "malformed" && (broken.errors?.length ?? 0) > 0).toBe(true);
      expect(workspace.readJson("broken.json")).toEqual({ kind: "malformed" });

      // The tri-state legs hold on the lenient face too.
      expect(workspace.readJsonLenient("absent.json")).toEqual({ kind: "missing" });
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("writeJson relativizes the declared path fields (doc/plan) to the repoRoot-relative shape (P9 T4 §2.7)", () => {
    const base = mkdtempSync(path.join(tmpdir(), "infra-ws-"));
    try {
      const workspace = new Workspace(new WorkspaceRoot(base, ".kairos/cdd"), "test-slug");
      const abs = path.join(base, "docs", "kairos", "plans", "p3.md");
      // The persisted shape is repoRoot-relative for the two DECLARED path keys; a
      // prose string that merely looks like a path (the `notes` array) is untouched.
      workspace.writeJson("progress.json", {
        waves: [{ wave: "1", reviewedRevision: { kind: "brief-revision", plan: abs } }],
        notes: [abs],
      });
      const onDisk = JSON.parse(
        readFileSync(path.join(workspace.path, "progress.json"), "utf8"),
      ) as { waves: { reviewedRevision: { plan: string } }[]; notes: string[] };
      expect(onDisk.waves[0]!.reviewedRevision.plan).toBe("docs/kairos/plans/p3.md");
      expect(onDisk.notes).toEqual([abs]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("readJson normalizes a legacy absolute path field on read — the backstop covers un-migrated bytes (P9 T4 §2.11)", () => {
    const base = mkdtempSync(path.join(tmpdir(), "infra-ws-"));
    try {
      const workspace = new Workspace(new WorkspaceRoot(base, ".kairos/cdd"), "test-slug");
      workspace.ensure();
      // A legacy write (absolute plan field) sits on disk; the read normalizes it —
      // the internal value is the canonical relative shape even without migration.
      const abs = path.join(base, "docs", "kairos", "plans", "legacy.md");
      writeFileSync(
        path.join(workspace.path, "progress.json"),
        JSON.stringify({ reviewedRevision: { plan: abs } }),
        "utf8",
      );
      const read = workspace.readJson<{ reviewedRevision: { plan: string } }>("progress.json");
      expect(read.kind).toBe("ok");
      expect(read.kind === "ok" && read.value.reviewedRevision.plan).toBe(
        "docs/kairos/plans/legacy.md",
      );
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
