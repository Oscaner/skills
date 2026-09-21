// engine/tests/contract.test.mjs — T2: commit-contract + handoff write 模块单测（Node port）。
// 移植 cdd-commit-gate-smoke.sh（16 断言）的核心行为：
//   dirty-tree → blocked + handoff.status=BLOCKED；head-mismatch → blocked（F1）；
//   clean-tree → pass；非 git / 无 repoRoot → fail-open ok:true；
//   review 模式 → dirty-only（T8：跳过 head 校验 —— review handoff 的 commits 语义为被审 commit）。
// 移植 cdd-severity-contract.test.sh（30 断言）的语义核心（非 grep 散文，而是可执行契约）：
//   classifySeverity：blocker→CHANGES_REQUESTED；warn/nit→APPROVED；unverifiable/needs_context→STOP。
//   rollupStatus：warn/nit→APPROVED；含 blocker→CHANGES_REQUESTED；unverifiable/plan_conflicts→BLOCKED。
//   validateHandoffSchema：notes 可选字段被 schema 接受（AC10，Enh T）。
// writeHandoff：按 packages/cdd-engine/templates/schema/task-handoff-schema.json（docs 族 docs-handoff-schema.json；命名/workspace 见 engine-config.json#handoffNamespace）写 + 合并已有（H6 链 update 语义）。
import { it, expect } from 'vitest';
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// The commit-contract block (this file, lines 52–186) was re-based by Task 5 to point at
// ../commit.ts (the simple-git backend at @infra/git.ts) — semantics preserved word for word, only
// the sync call became await (the "API re-base claim" has exactly one owner, rules/commit.ts from Task 5). gitCatFileCommitExists now points at infra/git.ts. (T2)
import { validateCommitContract } from "../commit.ts";
import { gitCatFileCommitExists } from "../../infra/git.ts";
import { writeHandoff, writeOwnHandoff } from "../../artifacts/handoff/write.ts";
import { classifySeverity, rollupStatus, deriveReviewStatus, normalizeHandoffStatus } from "../../artifacts/handoff/finalize.ts";
import { validateHandoffSchema, loadHandoffSchema } from "../schema.ts";

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// setup_repo —— port 自 cdd-commit-gate-smoke.sh：新 git repo，.gitignore 忽略 cdd/（workspace 目录）。
function setupRepo() {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-contract-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(dest, "-c", "user.name=cdd-gate-test", "-c", "user.email=cdd-gate-test@example.com", "commit", "--allow-empty", "-qm", "fixture");
  return dest;
}

// seedHandoff —— 在 gitignored cdd/ 下种 handoff（不弄脏 tracked tree）。
function seedHandoff(repo, task, commits) {
  const dir = path.join(repo, "cdd");
  mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `task-${task}-handoff.json`);
  writeFileSync(p, JSON.stringify({ status: "DONE", phase: "implement", task, commits }));
  return p;
}

function headOf(repo) {
  return git(repo, "rev-parse", "HEAD");
}

it("commit-contract: dirty tree implement → ok:false（D3b 同样适用 implement）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const r = await validateCommitContract("implement", repo);
  expect(r.ok).toBe(false);
  expect(r.blocker).toMatch(/uncommitted changes at return/);
});

it("commit-contract: clean tree → ok:true（handoff 不重写）", async () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const handoff = seedHandoff(repo, 1, { base: head, head });
  const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
  expect(r.ok).toBe(true);
  // validateCommitContract 不改 status（归一化在 handoffStatus() 内存层，非文件层）
  expect(JSON.parse(readFileSync(handoff, "utf8")).status).toBe("DONE");
});

it("commit-contract: clean tree → ok:true + handoff status 归一化 OK → APPROVED", async () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const handoff = path.join(repo, "cdd", "task-1-handoff.json");
  const dir = path.join(repo, "cdd");
  mkdirSync(dir, { recursive: true });
  writeFileSync(handoff, JSON.stringify({ status: "OK", phase: "fix", task: 1, commits: { base: head, head } }));
  const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
  expect(r.ok).toBe(true);
  expect(JSON.parse(readFileSync(handoff, "utf8")).status).toBe("OK");
});

it("commit-contract: clean tree → ok:true + handoff status COMPLETED unchanged (validateCommitContract does not mutate status)", async () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const handoff = path.join(repo, "cdd", "task-1-handoff.json");
  const dir = path.join(repo, "cdd");
  mkdirSync(dir, { recursive: true });
  writeFileSync(handoff, JSON.stringify({ status: "COMPLETED", phase: "fix", task: 1, commits: { base: head, head } }));
  const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
  expect(r.ok).toBe(true);
  expect(JSON.parse(readFileSync(handoff, "utf8")).status).toBe("COMPLETED");
});

it("commit-contract: clean tree → ok:true + handoff status APPROVED 不变", async () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const handoff = path.join(repo, "cdd", "task-1-handoff.json");
  const dir = path.join(repo, "cdd");
  mkdirSync(dir, { recursive: true });
  writeFileSync(handoff, JSON.stringify({ status: "APPROVED", phase: "fix", task: 1, commits: { base: head, head } }));
  const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
  expect(r.ok).toBe(true);
  expect(JSON.parse(readFileSync(handoff, "utf8")).status).toBe("APPROVED");
});

it("commit-contract: clean tree + 无 handoff → ok:true（fail-open）", async () => {
  const repo = setupRepo();
  const r = await validateCommitContract("implement", repo, { handoffPath: path.join(repo, "cdd", "no-such.json") });
  expect(r.ok).toBe(true);
});

it("commit-contract: clean tree + handoff.head ≠ HEAD → ok:false（F1）", async () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const wrong = "0000000000000000000000000000000000000000";
  const handoff = seedHandoff(repo, 1, { base: head, head: wrong });
  const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
  expect(r.ok).toBe(false);
  expect(r.blocker).toMatch(/handoff commits.head .* does not match HEAD/);
  expect(JSON.parse(readFileSync(handoff, "utf8")).status).toBe("BLOCKED");
});

it("commit-contract: handoff.head=dry-run → head-mismatch（哨兵已移除，对齐 bash）", async () => {
  const repo = setupRepo();
  const handoff = seedHandoff(repo, 1, { base: "dry-run", head: "dry-run" });
  const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
  expect(r.ok).toBe(false);
  expect(r.blocker).toMatch(/handoff commits.head dry-run does not match HEAD/);
});

// #186 SHA prefix 兼容：handoff.head 是实际 HEAD 的前缀 → ok:true（兼容历史 7-char handoff）
it("commit-contract #186: handoff.head=7-char prefix of HEAD → ok:true（prefix fallback）", async () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const prefix = head.slice(0, 7);
  const handoff = seedHandoff(repo, 1, { base: head, head: prefix });
  const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
  expect(r.ok).toBe(true);
});

it("commit-contract #186: handoff.head=non-prefix 7-char → ok:false（mismatch）", async () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const wrong = "0000000";
  const handoff = seedHandoff(repo, 1, { base: head, head: wrong });
  const r = await validateCommitContract("fix", repo, { handoffPath: handoff });
  expect(r.ok).toBe(false);
  expect(r.blocker).toMatch(/does not match HEAD/);
});

it("commit-contract: 非 git 目录 → fail-open ok:true", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-nogit-"));
  const r = await validateCommitContract("fix", dir, { handoffPath: path.join(dir, "task-1-handoff.json") });
  expect(r.ok).toBe(true);
});

// ---- Review mode: dirty-only validation, skipping the head check (T8) ----

it("commit-contract: review 模式 → dirty tree BLOCKED（review 亦校验 dirty；不再 no-op）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const r = await validateCommitContract("review", repo);
  expect(r.ok).toBe(false);
  expect(r.blocker).toMatch(/uncommitted changes at return \(review\)/);
});

it("commit-contract: review 模式 → clean tree 跳过 head 校验（handoff.commits.head≠HEAD 不 BLOCKED）", async () => {
  const repo = setupRepo();
  const head = headOf(repo);
  const wrong = "0000000000000000000000000000000000000000";
  const handoff = seedHandoff(repo, 1, { base: head, head: wrong });
  const r = await validateCommitContract("review", repo, { handoffPath: handoff });
  expect(r.ok).toBe(true);
});

it("commit-contract: 无 repoRoot → fail-open ok:true（直接-set 非 git workspace；不得误检 caller cwd）", async () => {
  const r = await validateCommitContract("implement", null);
  expect(r.ok).toBe(true);
});

it("commit-contract: 未知 mode 名 → no-op ok:true（非法 mode 不接线）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const r = await validateCommitContract("bogus", repo);
  expect(r.ok).toBe(true);
});

it("classifySeverity: blocker → CHANGES_REQUESTED", () => {
  expect(classifySeverity("blocker")).toBe("CHANGES_REQUESTED");
});

it("classifySeverity: warn/nit → APPROVED（Enh S）", () => {
  expect(classifySeverity("warn")).toBe("APPROVED");
  expect(classifySeverity("nit")).toBe("APPROVED");
});

it("classifySeverity: unverifiable / needs_context → STOP", () => {
  expect(classifySeverity("unverifiable")).toBe("STOP");
  expect(classifySeverity("needs_context")).toBe("STOP");
});

it("classifySeverity: 未知 severity → 抛错（契约违规）", () => {
  expect(() => classifySeverity("critical")).toThrow(/unknown severity/);
});

it("rollupStatus: 空 / 仅 warn·nit → APPROVED", () => {
  expect(rollupStatus([])).toBe("APPROVED");
  expect(rollupStatus([{ severity: "warn" }, { severity: "nit" }])).toBe("APPROVED");
});

it("rollupStatus: 含 blocker（即使兼有 warn/nit）→ CHANGES_REQUESTED", () => {
  expect(rollupStatus([{ severity: "warn" }, { severity: "blocker" }])).toBe("CHANGES_REQUESTED");
  expect(rollupStatus([{ severity: "blocker" }])).toBe("CHANGES_REQUESTED");
});

it("rollupStatus: unverifiable / plan_conflicts 非空 → BLOCKED", () => {
  expect(rollupStatus([], ["cannot verify"])).toBe("BLOCKED");
  expect(rollupStatus([], [], [{ plan_section: "§2", finding_summary: "x" }])).toBe("BLOCKED");
});

// ---- deriveReviewStatus — review-type status derivation (engine sole authority) + SP-4 failed-round exemption (T5) ----

it("deriveReviewStatus: warn/nit only → APPROVED（覆写 agent CHANGES_REQUESTED）", () => {
  const h = { status: "CHANGES_REQUESTED", findings: [{ severity: "warn" }, { severity: "nit" }] };
  expect(deriveReviewStatus(h)).toBe("APPROVED");
});

it("deriveReviewStatus: blocker present → CHANGES_REQUESTED", () => {
  const h = { status: "APPROVED", findings: [{ severity: "blocker" }] };
  expect(deriveReviewStatus(h)).toBe("CHANGES_REQUESTED");
});

it("deriveReviewStatus SP-4 豁免：agent status BLOCKED + findings:[] → 保持 BLOCKED", () => {
  const h = { status: "BLOCKED", findings: [] };
  expect(deriveReviewStatus(h)).toBe("BLOCKED");
});

it("deriveReviewStatus SP-4 豁免：engine TIMEOUT + findings:[] → 保持 TIMEOUT", () => {
  const h = { status: "TIMEOUT", findings: [] };
  expect(deriveReviewStatus(h)).toBe("TIMEOUT");
});

it("deriveReviewStatus: findings 空 + status APPROVED → 保持 APPROVED（空载通过不误变）", () => {
  const h = { status: "APPROVED", findings: [] };
  expect(deriveReviewStatus(h)).toBe("APPROVED");
});

it("deriveReviewStatus branch nit⑥：findings 空 + plan_conflicts 非空 → BLOCKED（BLOCKED 通道不依赖 findings 承载）", () => {
  expect(deriveReviewStatus({ status: "APPROVED", findings: [], plan_conflicts: ["c1"] })).toBe("BLOCKED");
  expect(deriveReviewStatus({ status: "APPROVED", findings: [], unverifiable: ["u1"] })).toBe("BLOCKED");
});

it("AC10: validateHandoffSchema accepts optional notes field（Enh T）", () => {
  const r = validateHandoffSchema({
    task: 1,
    phase: "fix",
    status: "APPROVED",
    artifacts: {},
    findings: [],
    notes: "test-evidence re-recorded after fixing findings",
  });
  expect(r).toEqual({ valid: true });
});

// ---- The contract pushed into the schema field descriptions (semantic assertions on both schemas) + allOf BLOCKED enforcement (Task 23 ②) ----

it("Task 23 task schema allOf: BLOCKED 必须 blocker 非空 或 failure_category —— 裸折契约违规", () => {
  const base = (extra: Record<string, unknown>) => ({ task: 1, phase: "implement", status: "BLOCKED", artifacts: {}, findings: [], ...extra });
  expect(validateHandoffSchema(base({}), "task").valid).toBe(false);            // 裸折 → 违规
  expect(validateHandoffSchema(base({ blocker: "" }), "task").valid).toBe(false); // 空字符串 blocker 不算数
  expect(validateHandoffSchema(base({ blocker: "真实原因" }), "task").valid).toBe(true);
  expect(validateHandoffSchema(base({ failure_category: "UNVERIFIABLE" }), "task").valid).toBe(true);
});

it("Task 23 task schema description 承载 status/failure_category/unverifiable 语义", () => {
  const p = (loadHandoffSchema("task") as { properties: Record<string, { description: string }> }).properties;
  expect(p.status.description).toContain("terminal");
  expect(p.status.description).toContain("failure_category");
  expect(p.failure_category.description.toLowerCase()).toContain("orthogonal");
  expect(p.unverifiable.description.toLowerCase()).toContain("dev-measured");
  expect(p.unverifiable.description).toContain("never blocks");
  expect(p.plan_conflicts.description).toContain("PLAN_CONFLICT");
  expect(p.blocker.description).toContain("never fabricated");
});

it("Task 23 docs schema: 14 props（+commits T5 + unverifiable/plan_conflicts + T25 changes/recovery）+ dev-measured 语义 + allOf BLOCKED 生效", () => {
  const schema = loadHandoffSchema("docs") as { properties: Record<string, { description: string }> };
  const props = schema.properties;
  expect(Object.keys(props)).toHaveLength(14);
  expect(props).toHaveProperty("unverifiable");
  expect(props).toHaveProperty("plan_conflicts");
  expect(props).toHaveProperty("changes"); // The changed-file attribution ledger (task/docs dual schemas) (T25)
  expect(props).toHaveProperty("recovery"); // The residue recovery carrier (task/docs dual schemas) (T25)
  expect(props).toHaveProperty("failure_category");
  expect(props).toHaveProperty("commits"); // docs handoff 逆转（T5）：commits{base,head} 与 task 族同一契约核心
  expect(props.unverifiable.description.toLowerCase()).toContain("dev-measured");
  expect(props.unverifiable.description).toContain("never blocks");
  expect(props.blocker.description).toContain("never fabricated");
  expect(props.status.description).toContain("terminal");
  const d = (extra: Record<string, unknown>) => ({ phase: "fix", status: "BLOCKED", findings: [], artifacts: {}, doc_path: "x.md", ...extra });
  expect(validateHandoffSchema(d({}), "docs").valid).toBe(false);
  expect(validateHandoffSchema(d({ blocker: "真实原因" }), "docs").valid).toBe(true);
  expect(validateHandoffSchema(d({ failure_category: "PLAN_CONFLICT" }), "docs").valid).toBe(true);
});

it("normalizeHandoffStatus: TIMEOUT → TIMEOUT（透传，无映射）", () => {
  expect(normalizeHandoffStatus("TIMEOUT")).toBe("TIMEOUT");
});

it("normalizeHandoffStatus: BLOCKED → BLOCKED", () => {
  expect(normalizeHandoffStatus("BLOCKED")).toBe("BLOCKED");
});

it("normalizeHandoffStatus: CHANGES_REQUESTED → CHANGES_REQUESTED", () => {
  expect(normalizeHandoffStatus("CHANGES_REQUESTED")).toBe("CHANGES_REQUESTED");
});

it("writeHandoff: 按 schema 写入 + 合并已有（保留 commits）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-handoff-"));
  const p = path.join(dir, "task-1-handoff.json");
  writeHandoff(p, {
    task: 1,
    phase: "implement",
    status: "DONE",
    commits: { base: "b", head: "h" },
    complexity: "simple",
    review_scope: "task",
    artifacts: { brief: "b.md", report: "r.md", test_evidence: "t.json" },
    test_evidence: { command: "node --test", passed: true, exit_code: 0, warnings_count: 0 },
    findings: [],
    unverifiable: [],
    plan_conflicts: [],
  });
  const h = JSON.parse(readFileSync(p, "utf8"));
  expect(h.status).toBe("DONE");
  expect(h.commits.head).toBe("h");
  expect(h.findings).toEqual([]);

  // H6 链 update：只改 status/blocker，其余字段保留
  writeHandoff(p, { status: "BLOCKED", blocker: "uncommitted changes at return" });
  const h2 = JSON.parse(readFileSync(p, "utf8"));
  expect(h2.status).toBe("BLOCKED");
  expect(h2.commits.head).toBe("h");
  expect(h2.task).toBe(1);
  expect(h2.blocker).toBe("uncommitted changes at return");
});

it("writeHandoff: 父目录不存在自动创建 + 已有非 JSON 覆盖为合法 JSON", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-handoff2-"));
  const p = path.join(dir, "sub", "task-2-handoff.json");
  writeHandoff(p, { task: 2, status: "DONE" });
  expect(existsSync(p)).toBe(true);
  expect(JSON.parse(readFileSync(p, "utf8")).status).toBe("DONE");

  writeFileSync(p, "garbage");
  writeHandoff(p, { status: "BLOCKED" });
  expect(JSON.parse(readFileSync(p, "utf8")).status).toBe("BLOCKED");
});

// ---- writeOwnHandoff — full overwrite on disk (the engine is the carrier's only author; not a shallow merge) (T7) ----

it("writeOwnHandoff: 全量覆盖替换（非浅合并）—— existing 字段一律不保留", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-woh-"));
  const p = path.join(dir, "sub", "task-1-implement.json");
  writeOwnHandoff(p, { junk: true, task: 1, phase: "implement", status: "APPROVED" });
  writeOwnHandoff(p, { task: 1, phase: "implement", status: "APPROVED", findings: [], artifacts: {} });
  const h = JSON.parse(readFileSync(p, "utf8"));
  expect(h).not.toHaveProperty("junk");
  expect(h).toEqual({ task: 1, phase: "implement", status: "APPROVED", findings: [], artifacts: {} });
});

it("writeOwnHandoff: 父目录递归创建 + 2-space 换行格式", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-woh2-"));
  const p = path.join(dir, "a", "b", "h.json");
  writeOwnHandoff(p, { task: 1 });
  expect(readFileSync(p, "utf8")).toBe(`${JSON.stringify({ task: 1 }, null, 2)}\n`);
});

it("gitCatFileCommitExists: real commit → true", async () => {
  const repo = setupRepo();
  const sha = headOf(repo);
  expect(await gitCatFileCommitExists(repo, sha)).toBe(true);
});

it("gitCatFileCommitExists: phantom SHA → false", async () => {
  const repo = setupRepo();
  expect(await gitCatFileCommitExists(repo, "0000000000000000000000000000000000000000")).toBe(false);
});

it("gitCatFileCommitExists: empty string → false", async () => {
  const repo = setupRepo();
  expect(await gitCatFileCommitExists(repo, "")).toBe(false);
});

it("gitCatFileCommitExists: null → false", async () => {
  const repo = setupRepo();
  expect(await gitCatFileCommitExists(repo, null)).toBe(false);
});
