#!/usr/bin/env node
// scripts/validate/residue.ts — block 5c: engine zero-residue + stale-lexicon + gate-lexicon grep.
// (sdd_/SDD_/sdd-run-/spor- must not regress in engine executable products; the
// stale-lexicon checks pin the P4/P6 migration end-state — old docs-review
// filenames, PASS=< lens params, D1|D2|D3 lens names, resolve-hit / gh issue
// reopen resolver vocabulary, the task-review mode, P4 degraded filenames, and
// the old docs root (pre-P2), the removed cdd subcommands `brief` / `research`
// (pre-P3, command-form only — bare words stay legal), and the removed research
// timeout envs — plus the P5 gate-lexicon checks pin the cdd-gate
// subsystem removal (bin/gate/
// path, CDD_GATE env, cdd-gate-core, gateDecide, deleted gate adapters) — must
// not creep back into mechanism/document positions.)
// Task 16 (P5) adds the report-issues legacy-model residue guard (the mechanism-side landing of the
// p5 design §2.8 "residue guard" row — AC1 word-boundary zero-hit / AC5 renderer zero-residue):
// bare report-issue (word-bounded; the plural report-issues skill name passes) / the --mode word
// form / renderComment / renderTitle / resolveDropdownOptions / sessionTypes /
// execFileSync("git") (hand-written git regression) — all zero-exemption in mechanism positions.
// T10 adds two reverse guards on the shipped surface (§2.8 rows 19-20): (1) zero
// osuperpowers-version version literal on the shipped non-emit surface (skills/** · plugin
// README); (2) zero `/init` references on the shipped surface (root README · plugin README) plus
// the collaborator surface (.changeset/README.md) — reverse residue checks after the init and
// version-stamp mechanism deletion.
// T11 adds the handoff-schema zero-hit guard (§2.8 row 14): `(?<!-)handoff-schema` (bare name /
// path form) zero-hit, with the negative lookbehind exempting canonical schema filenames — the
// handoff-schema.md deletion ships in the same commit as the guard.
// The grepTargets meta is consumed by the wiring guard
// (packages/osuperpowers/tests/ci-validate.test.mjs) to pin the target set.

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "tinyglobby";

import { runIfMain } from "./runner.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const OSKILLS = ["packages/osuperpowers/skills"];
// re-org (spec §2.13): cdd-engine mechanism files moved out of lib/ into the src/ target tree —
// scope constants unified on src (bin/ removed; the lib/ topology dispersed into
// src/{cli,dispatch,rules,artifacts,render,infra}, templates live in a standalone templates/).
const CDD_ENGINE_BIN = ["packages/cdd-engine/src"];
const CDD_ENGINE = [...CDD_ENGINE_BIN, "packages/cdd-engine/templates"];
// T9 nit3 (DRY): the mechanism-position set shared across skills + cdd-engine (src+templates) — used by 5 checks.
const ALL_MECH_POSITIONS = [...OSKILLS, ...CDD_ENGINE];
// Task 5 (P2): doc-surface targets — the governance-file surface (the most likely regression point
// for old docs-root residue): root CLAUDE.md (the active conventions entry), root README.md / plugin
// README.md (the published surface), and the maintainer docs directory.
// Path literals are never written into this file (a guard body must not become a carrier of the
// vocabulary it guards — see the comment beside GATE_TARGETS).
export const DOC_SURFACE_TARGETS = [
  "CLAUDE.md",
  "README.md",
  "packages/osuperpowers/README.md",
  "docs/maintainers",
];

const RESIDUE_TARGETS = [
  "packages/osuperpowers/bin",
  "packages/osuperpowers/skills",
  "packages/cdd-engine/src",
  "packages/cdd-engine/templates",
];
const RESIDUE_RE = /\b(sdd_|_sdd_|SDD_|sdd-run-|spor-)/;

// stale-lexicon zero-exemption (post P4/P6 naming normalization): mechanism positions only, empty
// whitelist — false positives are avoided by the grep patterns themselves not matching canonical
// vocabulary: finding-meta.json `dogfood (CDD session)` dropdown (only `"dogfood",` /
// `labels ....dogfood` match), the spec-review-{R}.json family of names (only the degraded
// `(spec|plan)-1\.json` form matches), contract.mjs's retained legal comments "spec D1/D4/D5a" and
// "dirty working tree (D2)" (the lens context restricts to the `D[123]:` prefix form).
const STALE_LEXICON_CHECKS = [
  { label: "old docs-review filename", re: /docs-review\.md/, scope: ALL_MECH_POSITIONS },
  { label: "PASS= lens param", re: /PASS=</, scope: ALL_MECH_POSITIONS },
  { label: "lens names D1|D2|D3 (lens-context)", re: /\bD[123][:：]/, scope: ALL_MECH_POSITIONS },
  { label: "resolve-hit", re: /resolve-hit/, scope: ALL_MECH_POSITIONS },
  { label: "gh issue reopen", re: /gh issue reopen/, scope: ALL_MECH_POSITIONS },
  // T9 nit6: the task-review old-mode-name scope uses CDD_ENGINE (src+templates), not just
  // CDD_ENGINE_BIN — templates (implement/fix/review) historically referenced the old mode name and
  // became a regression source, so templates must be scanned too.
  // T15 (design §2.8 row 21): scope widened to ALL_MECH_POSITIONS — bare task-review on the skills
  // surface was cleared in three batches (handoff-schema.md → cli-driven-development SKILL.md →
  // _docs/review.md), so this scope is the standing regression face; the regex converges to the old
  // mode-name shape (negative lookbehind exempts the new digraph node name run-task-review).
  { label: "old mode task-review", re: /(?<!run-)task-review/, scope: ALL_MECH_POSITIONS },
  { label: "P4 degraded names", re: /(spec|plan)-1\.json|doc-fix-/, scope: CDD_ENGINE },
  {
    label: "flat docs-review root fallback",
    re: /\.superpowers\/docs-review/,
    scope: CDD_ENGINE_BIN,
  },
  {
    label: "old runtime root .superpowers/cdd",
    re: /\.superpowers\/cdd/,
    scope: ALL_MECH_POSITIONS,
  },
  { label: "deleted standalone root", re: /\.superpowers\/standalone/, scope: ALL_MECH_POSITIONS },
  { label: "dogfood as label", re: /labels [^\n]*dogfood|"dogfood",/, scope: OSKILLS },
  // Task 5 (P2): old docs root (the pre-P2 superpowers layout, pre-normalization) guard — zero
  // exemption at mechanism positions. Merged into the doc surface (DOC_SURFACE_TARGETS); the regex
  // escapes `\/` and labels carry no path literal, so the guard body never writes the guarded
  // old-root literal back into scripts/ (or the repo-wide check would gain a third hit class).
  {
    label: "old docs root (pre-P2)",
    re: /docs\/superpowers/,
    scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS],
  },
  // Task 5 (P3): removed cdd subcommands (**command-form only**, not bare words — the P4-legal
  // /mattpocock-skills:research session calls and the live text `brief-dependent plan sections` at
  // cli-driven-development/SKILL.md:66 must all pass) + the research-only timeout env (root-deleted
  // along with LEGACY_MODE_ENV/modeEnv.research).
  {
    label: "removed cdd subcommand (pre-P3)",
    re: /\bcdd (brief|research)\b/,
    scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS],
  },
  //   The single `RESEARCH_TIMEOUT` branch already covers both deleted forms (`CDD_RESEARCH_TIMEOUT`
  //   and the legacy bare name) — substring semantics with an unanchored alternation make the `CDD_`
  //   prefix branch a dead branch (T5 review-1 nit, verified equivalent), hence the suffix-only
  //   branch; the old "retained surface" of `CDD_TASK_TIMEOUT` / `CDD_REVIEW_TIMEOUT` was
  //   root-deleted with the three T26 keys (CDD_TASK_TIMEOUT/CDD_REVIEW_TIMEOUT/CDD_CLI_TIMEOUT now
  //   zero-read — the env surface is a closed-set guard).
  { label: "removed research timeout env", re: /RESEARCH_TIMEOUT/, scope: CDD_ENGINE },
  // Task 16 (P5): report-issues legacy-model residue guard — the legacy-model vocabulary (--mode flag
  // / renderComment / renderTitle / resolveDropdownOptions / sessionTypes / bare report-issue) was
  // cleared in the rewrite closing round; this guard prevents regression. `report-issue` must be
  // word-bounded (\b) — the plural `report-issues` skill name and `report-links-only` nodes are
  // legal (a substring match would false-positive the plural). `--mode` uses the word form (negative
  // lookbehind/lookahead exempt the internal `mode:` attribute and derived tokens like --modeYaml).
  // `execFileSync("git")` blocks hand-written git regression (the engine's sole spawn channel =
  // proc.mjs's execa). Scope is entirely mechanism positions (ALL_MECH_POSITIONS); scripts/ is in no
  // scope, so this file's written surface cannot self-hit.
  {
    label: "bare report-issue (word-bounded; plural report-issues passes)",
    re: /\breport-issue\b/,
    scope: ALL_MECH_POSITIONS,
  },
  {
    label: "old --mode flag (task-level mode removed)",
    re: /(?<![\w-])--mode(?![-\w])/,
    scope: ALL_MECH_POSITIONS,
  },
  {
    label: "renderComment old renderer vocabulary",
    re: /\brenderComment\b/,
    scope: ALL_MECH_POSITIONS,
  },
  {
    label: "renderTitle old renderer vocabulary",
    re: /\brenderTitle\b/,
    scope: ALL_MECH_POSITIONS,
  },
  {
    label: "resolveDropdownOptions old dropdown resolution",
    re: /\bresolveDropdownOptions\b/,
    scope: ALL_MECH_POSITIONS,
  },
  {
    label: "sessionTypes old session classification",
    re: /\bsessionTypes\b/,
    scope: ALL_MECH_POSITIONS,
  },
  {
    label: 'execFileSync("git") hand-written git regression',
    re: /\bexecFileSync\(\s*["']git["']/,
    scope: ALL_MECH_POSITIONS,
  },
  // Task 2 (P6): the vendors self-maintenance surface was removed — regression-vocabulary guard
  // (B12). scope = ALL_MECH_POSITIONS zero-exemption (docs/maintainers's vendor-reference cleanup is
  // deferred to the F-domain reorganization per spec F7, not on this surface). Word forms keep the
  // compact shapes: `vendors/` (path form, not a bare vendor word), `publish-vendor` (word form,
  // covering file/step/subcommand names), `submodule[s]` (word form — both git submodule and
  // submodules: recursive hit).
  {
    label: "vendors/ self-maintenance path-form regression",
    re: /vendors\//,
    scope: ALL_MECH_POSITIONS,
  },
  {
    label: "publish-vendor word-form regression",
    re: /\bpublish-vendor\b/,
    scope: ALL_MECH_POSITIONS,
  },
  { label: "submodule word-form regression", re: /\bsubmodule[s]?\b/, scope: ALL_MECH_POSITIONS },
  // Task 19 (P6, spec F2): `.agents/` emit-surface removal (A5) + droid/pi keywords (A3) regression
  // guard. `.agents` uses the path/end-of-line form (`.agents/` or `.agents` at EOL; `m` makes `$`
  // line-local); bare mentions in other files are legal prose and stay. scope = ALL_MECH_POSITIONS
  // zero-exemption (docs/maintainers's stale-reference cleanup is deferred to the F-domain
  // reorganization per spec F7, not on this surface — same ruling as vendors); droid/pi guards only
  // the A3 landing package.json (`\bpi\b` hits both the dead `#pi` field name and the keywords pi
  // word; no repo-wide bare words — pipeline/principle etc. are legal English words).
  {
    label: ".agents/ emit-surface regression (post-A5 removal)",
    re: /\.agents(\/|$)/m,
    scope: ALL_MECH_POSITIONS,
  },
  {
    label: "droid/pi keywords regression (A3 package.json)",
    re: /\bdroid\b|\bpi\b/,
    scope: ["packages/osuperpowers/package.json"],
  },
  // Task 23 (P6, spec F8a): H1 semantic-name mechanism guard (zero-exemption). Two complementary
  // lanes: `\bH1\b` hits the bare uppercase word `H1` (word-bounded on both sides — `1` needs a
  // non-word char after it, so `H1_BLOCK`'s `_` is a word char and never hits; the underscore form
  // is covered by the lowercase lane below); `/\bh1(?=[A-Z]|\b)/` hits the src-side lowercase
  // camelCase identifiers (h1FromHandoff / h1FourLines / h1Blocker / h1CountersLine / #h1 / res.h1),
  // zero-exemption — after F8a semanticization the return* surface must not retain the old token
  // forms. Layered scope: the uppercase lane covers all mechanism positions (src + templates +
  // skills body, where the prompt body has zero H1 post-F8a); the lowercase-identifier lane is src
  // only (CDD_ENGINE_BIN) — the skills surface never used h1* lowercase identifiers, no regression
  // face. Neither regex anchors the new vocabulary (return block / returnFourLines etc.), no
  // self-hit.
  {
    label: "H1 vocabulary (residual) (post-F8a semanticization)",
    re: /\bH1\b/,
    scope: ALL_MECH_POSITIONS,
  },
  {
    label: "h1* identifiers (residual) (post-F8a semanticization)",
    re: /\bh1(?=[A-Z]|\b)/,
    scope: CDD_ENGINE_BIN,
  },
  // Task 18 (P6, spec F8): the old vocabulary after the Review Convergence term rename,
  // zero-exemption. Three complementary lanes —
  //  ① `Review Stopping` term form (word-bounded) in all mechanism positions + the governance doc
  //     surface; the banned-name table (naming-conventions's terminology registry) cites it in
  //     **composite form** (review_stopping / fix_loop_exhausted / timeout_exhausted — the
  //     underscore is a word char and breaks the word boundary, matching the \bH1\b composite-form
  //     precedent for H1_BLOCK);
  //  ② the lowercase `stopping` identifier/module form scans the engine surface only (src +
  //     templates — src has zero stopping modules/identifiers, templates' historical references are
  //     a regression source); the skills surface's English prose contains stop/stops/stopped (legal
  //     surface), and the Review Convergence term form is already covered by ①;
  //  ③ the retired failure-face literals (fix-loop-exhausted / timeout-exhausted) →
  //     review-cycle-cap / dispatch-timeout-cap, registered under the same composite form. None of
  //     the three regexes matches the new vocabulary (Review Convergence / review-cycle-cap /
  //     dispatch-timeout-cap share no old-form substring), no self-hit.
  {
    label: "Review Stopping retired term (F8 → Review Convergence)",
    re: /\bReview Stopping\b/,
    scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS],
  },
  {
    label: "stopping modules/identifiers (engine surface zero-residue post-F8 rename)",
    re: /\bstopping\b/,
    scope: CDD_ENGINE,
  },
  {
    label: "retired failure-face literals (F8 → review-cycle-cap / dispatch-timeout-cap)",
    re: /\bfix-loop-exhausted\b|\btimeout-exhausted\b/,
    scope: [...ALL_MECH_POSITIONS, ...DOC_SURFACE_TARGETS],
  },
];

// T6 (P5): gate-specific vocabulary zero-exemption (mirrors the P6 F5 stale-lexicon guard; same
// boundary stance as the T7 grep1 set). After the cdd-gate subsystem removal
// (packages/osuperpowers/bin/gate/ deleted whole-tree), its vocabulary must not creep back into
// mechanism/document surfaces: cdd-engine bin + osuperpowers skills + docs/maintainers + root
// README. Exemptions (registered non-targets): docs/osuperpowers/{specs,plans} (the new home of
// historical docs; spec/plan deletion-surface descriptions necessarily carry gate vocabulary, and
// it is not in the gate targets), packages/osuperpowers/CHANGELOG.md (historical record, not a
// mechanism position), engine src/**/__tests__ (reverse-guard test sites must cite the vocabulary;
// collectGateLexiconHits rides walkTargetFiles' default self-exemption and never scans them) — the
// same stance as the T2 Step 4 docs-runner CDD_GATE comment cleanup. False positives are avoided
// by compact pattern shapes (path/gate-word forms) rather than bare `gate`/`cdd-gate-`: ship gate /
// evidence-gate / {{HARD_GATE}} / the cdd-gate-test git identity all zero-hit.
// Task 5 (P2): GATE_TARGETS and DOC_SURFACE_TARGETS share 2 **intentional overlaps** (`docs/maintainers`
// and the root `README.md`) — they serve different vocabularies (gate-subsystem removal vs old docs
// root), not duplicate declarations; the root `README.md` is a new stale-lexicon coverage addition
// (GATE_TARGETS is only consumed by GATE_LEXICON_CHECKS). Hit surfaces must be re-pointed in sync,
// never silently drifted.
const GATE_TARGETS = [...CDD_ENGINE_BIN, ...OSKILLS, "docs/maintainers", "README.md"];
const GATE_LEXICON_CHECKS = [
  { label: "deleted gate dir bin/gate/", re: /\bbin\/gate\b/, scope: GATE_TARGETS },
  { label: "CDD_GATE env", re: /CDD_GATE/, scope: GATE_TARGETS },
  { label: "cdd-gate-core module", re: /cdd-gate-core\b/, scope: GATE_TARGETS },
  { label: "gateDecide callable", re: /\bgateDecide\b/, scope: GATE_TARGETS },
  { label: "deleted gate adapters", re: /gate\/adapters\//, scope: GATE_TARGETS },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Shared scanning: tinyglobby replaces the hand-written recursion; `dot: true` scans hidden
// subdirectories (.claude-plugin/). T6: directory targets glob **/*, single-file targets (root
// README.md) are read directly; targets may be repo-relative or absolute paths (the latter lets
// collectGateLexiconHits tests inject a temp directory). T7: exported for reuse by smoke-cdd.ts's
// final reconciliation (deletion-surface sweep), not reimplemented.
// review-1 warn (Duplicated Code): unified walk helper — scanTargets / scanLines / listTargetFiles
// originally held three near-identical walks (target resolution → missing throw → glob expansion →
// binary skip) copied line-by-line, so editing one silently drifted the rest; now converged into the
// single walkTargetFiles, with the three consumers doing only their own matching/mapping. A missing
// target throws a clear Error naming the target (aligned with the G7/G8 "deleted path has returned"
// style) — future renames/deletions fail as a readable guard failure instead of an obscure statSync
// ENOENT crash. `**/__tests__/` is skipped by default (post P6 Task 3, co-located test sites joined
// the src tree) — the guard/test self-exemption doctrine's walk-side landing: tests asserting "dead
// vocabulary absent" necessarily carry the guarded words, so mechanism scans must not trust test
// sites; guards that do scan tests (seam gaps / old root-resolver names) opt in explicitly via
// `{ includeTests: true }`, with scope still written as src/... (never the deleted tests/).
function walkTargetFiles(targets, { includeTests = false } = {}) {
  const out = [];
  for (const t of targets) {
    const abs = path.isAbsolute(t) ? t : path.join(ROOT, t);
    if (!existsSync(abs)) {
      throw new Error(
        `walkTargetFiles: target missing — ${t} (deleted file? adjust target set or this sweep scope)`,
      );
    }
    const paths = statSync(abs).isDirectory()
      ? globSync("**/*", { cwd: abs, absolute: true, dot: true })
      : [abs];
    for (const f of paths) {
      if (readFileSync(f).includes(0)) continue; // binary — grep -rn reports, doesn't content-match
      if (!includeTests && f.includes(`${path.sep}__tests__${path.sep}`)) continue;
      out.push(f);
    }
  }
  return out;
}

export function scanTargets(targets, re, opts) {
  const hits = [];
  for (const f of walkTargetFiles(targets, opts)) {
    if (re.test(readFileSync(f).toString("utf8"))) hits.push(path.relative(ROOT, f));
  }
  return hits;
}

function checkZeroResidue() {
  const hits = scanTargets(RESIDUE_TARGETS, RESIDUE_RE);
  assert(
    hits.length === 0,
    `RESIDUE FOUND — sdd_/SDD_/sdd-run-/spor- in engine executable products:\n  ${hits.join("\n  ")}`,
  );
  console.log("OK — zero residue in engine executable products");
}

export function hasHit(lines) {
  return [...STALE_LEXICON_CHECKS, ...GATE_LEXICON_CHECKS].some(({ re }) =>
    lines.some((line) => re.test(line)),
  );
}

// targetsOverride mirrors collectGateLexiconHits — lets tests inject temporary targets to verify the
// **doc-surface face** (DOC_SURFACE_TARGETS) is actually in the scan (otherwise a scope shrink goes
// unnoticed by any assertion).
export function collectStaleLexiconHits(targetsOverride) {
  const hits = [];
  for (const { label, re, scope } of STALE_LEXICON_CHECKS) {
    for (const f of scanTargets(targetsOverride ?? scope, re)) hits.push({ label, file: f });
  }
  return hits;
}

// T6: isomorphic to collectStaleLexiconHits; `targetsOverride` lets tests inject a temp directory
// to verify scan hits.
export function collectGateLexiconHits(targetsOverride) {
  const hits = [];
  for (const { label, re, scope } of GATE_LEXICON_CHECKS) {
    for (const f of scanTargets(targetsOverride ?? scope, re)) hits.push({ label, file: f });
  }
  return hits;
}

import { mainCommand } from "../../packages/cdd-engine/src/cli/parse.ts";
// =====================================================================
// Task 8 — channel audit (design §2.8 rows 1-11, 13; the engine-side 12 checks)
// =====================================================================
// The guard surfaces share a canonical source: the env direct-read whitelist (row 2) / argv flag
// set (row 9) / failure categories and counters (row 13) all come from cdd-engine's single read
// entry points (loadContract / FAILURE_CATEGORIES / FailureResolver#counters), never a second
// literal copy in this file — so the guard itself is not a carrier of the vocabulary it guards
// (Task 7 ①: counters() is a FailureResolver instance method — the guard consumes the class face).
// The two row-5 old root-resolver names are built by concatenation (the ⑤ target set includes
// scripts/, so the guard body must not write the guarded words as contiguous literals or it
// self-hits).
import { loadContract } from "../../packages/cdd-engine/src/infra/context.ts";
import {
  FAILURE_CATEGORIES,
  FailureResolver,
} from "../../packages/cdd-engine/src/rules/failure.ts";

const failureResolver = new FailureResolver();

const CONTRACT = loadContract();
// Row-2 whitelist = canonical channels.env var + markers (§2.4.4-(1) 4 keys; converged after the
// three rounds of T14/T26 env-key deletions).
export const ENV_DIRECT_READ_WHITELIST = new Set(
  Object.values(CONTRACT.channels.env).flatMap((ch) =>
    [ch.var, ...(ch.markers ?? [])].filter(Boolean),
  ),
);
// Row-9 canonical argv flag set (channels.argv's flag field; includes the program-level --dry-run
// and -h/--help).
export const CANONICAL_ARGV_FLAGS = new Set(
  Object.values(CONTRACT.channels.argv)
    .map((a) => a.flag)
    .filter(Boolean),
);
// Row-5 old root-resolver names (concatenated construction: the ⑤ scope includes scripts/, so the
// guard body keeps zero contiguous literals).
const ROOT_FROM_DOC = "root" + "FromDoc" + "Path";
const RESOLVE_REPO_ROOT = "resolve" + "Repo" + "Root";

// Line-by-line scan helper (built on walkTargetFiles' file surface): each hit returns
// { file, lineNo, text }.
export function scanLines(targets, re, opts) {
  const hits = [];
  for (const f of walkTargetFiles(targets, opts)) {
    const lines = readFileSync(f).toString("utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i]))
        hits.push({ file: path.relative(ROOT, f), lineNo: i + 1, text: lines[i] });
    }
  }
  return hits;
}

// File-listing helper (scanLines' file surface): the repo-relative paths of every non-binary file
// in the target set (for structure assertions / cross-file comparison).
function listTargetFiles(targets) {
  return walkTargetFiles(targets).map((f) => path.relative(ROOT, f));
}

/** ① Row 1: process.cwd() count in engine src = 1 and the sole hit file = src/bin.ts (both are asserted). */
export function collectProcessCwdAudit(targetsOverride = CDD_ENGINE_BIN) {
  const m = scanLines(targetsOverride, /process\.cwd\(\)/);
  const hits = [];
  if (m.length !== 1) {
    for (const { file, lineNo } of m) {
      hits.push({
        label: "process.cwd() non-single (expected exactly 1 in engine src)",
        file: `${file}:${lineNo}`,
      });
    }
    if (m.length === 0) {
      hits.push({
        label:
          "process.cwd() missing (the src/bin.ts initRoot conversion point removed or renamed)",
        file: "packages/cdd-engine/src/bin.ts",
      });
    }
    return hits;
  }
  if (!m[0].file.endsWith(path.join("src", "bin.ts"))) {
    hits.push({
      label:
        "process.cwd() not converged to src/bin.ts (the only hit conversion point is elsewhere)",
      file: `${m[0].file}:${m[0].lineNo}`,
    });
  }
  return hits;
}

// ② Row 2: the three direct-read shapes (process.env.X / process.env["X"] / env.X); a non-whitelist
// key → hit.
const ENV_READ_RE =
  /(?:\bprocess\.env|\benv)\.([A-Za-z_][A-Za-z0-9_]*)|(?:\bprocess\.env|\benv)\[["']([^"']+)["']\]/;
export function collectEnvDirectReadHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  const g = new RegExp(ENV_READ_RE.source, "g"); // line-wide capture (one line can host several shapes)
  for (const { file, lineNo, text } of scanLines(targetsOverride, ENV_READ_RE)) {
    let m: RegExpExecArray | null = g.exec(text);
    while (m !== null) {
      const key = m[1] ?? m[2];
      if (key && !ENV_DIRECT_READ_WHITELIST.has(key)) {
        hits.push({
          label: `process.env/env direct-read key off whitelist (§2.4.4-(1)): ${key}`,
          file: `${file}:${lineNo}`,
        });
      }
      m = g.exec(text);
    }
  }
  return hits;
}

// (3) Row 3a: whole-env pass-through points ⊆ §2.4.4-(2) inventory (4 host files, classified per
// site shape; full-line comments are not pass-through points). Task 9
// branch-fix channel mirrors branch-review (whole env table passes via invokeCliWithRetry args).
// P6 T24 A: the two branch channels moved into the BranchLifecycle family (dispatch/branch.ts); the
// passthrough hosts moved up from cli/branch-*.ts accordingly.
const ENV_PASSTHROUGH_SITES = [
  { file: "packages/cdd-engine/src/dispatch/task.ts", re: /#opts\.env \?\? process\.env/ },
  {
    file: "packages/cdd-engine/src/dispatch/docs.ts",
    re: /invokeCli\(entry, prompt, \{ op: mode, type \}, process\.env, this\.ctx\.repoRoot|process\.env,$/,
  },
  { file: "packages/cdd-engine/src/cli/shared.ts", re: /detectCurrentHarness\(process\.env\)/ },
  {
    file: "packages/cdd-engine/src/dispatch/branch.ts",
    re: /invokeCliWithRetry\([^)]*process\.env, |process\.env,$/,
  },
];
const ENV_WHOLE_RE = /process\.env([^.\w[]|$)/;
export function collectEnvPassThroughHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, ENV_WHOLE_RE)) {
    if (text.trimStart().startsWith("//")) continue; // a comment mention is not a pass-through point
    const san = ENV_PASSTHROUGH_SITES.find((s) => s.file === file && s.re.test(text));
    if (!san)
      hits.push({
        label: `whole-env pass-through point off the §2.4.4-(2) inventory (4 sites): ${text.trim().slice(0, 48)}`,
        file: `${file}:${lineNo}`,
      });
  }
  return hits;
}

/** ③ Row 3b: zero spread injection ({ ...process.env, ... }). */
export function collectEnvSpreadHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo } of scanLines(targetsOverride, /\.\.\.process\.env/)) {
    hits.push({
      label:
        "process.env spread injection (§2.4.4 whole table passes via parameters, no spread object build)",
      file: `${file}:${lineNo}`,
    });
  }
  return hits;
}

/** ③ Row 3c: the six key names zero-hit (CDD_LIFECYCLE_PATH / CDD_REGISTRY_PATH / NODE_ENV / CDD_DRY_RUN / PLAN_FILE / CDD_HANDOFF_PATH; grep -rnE includes comment lines). */
export function collectSixEnvKeyHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo } of scanLines(
    targetsOverride,
    /CDD_LIFECYCLE_PATH|CDD_REGISTRY_PATH|NODE_ENV|CDD_DRY_RUN|PLAN_FILE|CDD_HANDOFF_PATH/,
  )) {
    hits.push({
      label: "env-channel key-name regression (six keys zero-hit)",
      file: `${file}:${lineNo}`,
    });
  }
  return hits;
}

// ④ Row 4: path-class arguments (--plan/--spec/--findings) all go through the single resolver.
// Negative assertion = directly using the raw argument (bypassing the resolveDocArg normalization);
// positive assertion = the 5 call-site files (the T2 "normalization entry closure") must all
// reference resolveDocArg.
const PATH_ARG_SCOPE = ["packages/cdd-engine/src/cli", "packages/cdd-engine/src/dispatch/task.ts"];
// review-1 nit: side-lane completion — readFileSync's fs/promises async sibling `readFile(opts.*)`
// and the dynamic import evaluating the same path argument (`import(opts.*)`) were previously off
// the surface (the mechanical face follows the implementer's choice; this face must be complete).
const PATH_ARG_BYPASS_RE =
  /resolveWorkspace\(opts\.(plan|spec|findings)|workspaceSlug\(opts\.(plan|spec|findings)|readFileSync\(opts\.(plan|spec|findings)|readFile\(opts\.(plan|spec|findings)|existsSync\(opts\.(plan|spec|findings)|import\(opts\.(plan|spec|findings)|path\.join\([^)]*opts\.(plan|spec|findings)/;
const RESOLVER_FILES = [
  "packages/cdd-engine/src/cli/shared.ts",
  "packages/cdd-engine/src/cli/fix.ts",
  "packages/cdd-engine/src/cli/review.ts",
  "packages/cdd-engine/src/cli/base-branch.ts",
  "packages/cdd-engine/src/dispatch/task.ts",
];
export function collectPathArgResolverHits(scopeOverride, resolverFilesOverride) {
  const scope = scopeOverride ?? PATH_ARG_SCOPE;
  const files = resolverFilesOverride ?? RESOLVER_FILES;
  const hits = [];
  for (const { file, lineNo, text } of scanLines(scope, PATH_ARG_BYPASS_RE)) {
    hits.push({
      label: `path argument used directly, bypassing the resolver (resolveDocArg normalization missing): ${text.trim().slice(0, 48)}`,
      file: `${file}:${lineNo}`,
    });
  }
  for (const f of files) {
    const text = readFileSync(path.isAbsolute(f) ? f : path.join(ROOT, f), "utf8");
    if (!/\bresolveDocArg\b/.test(text)) {
      hits.push({
        label:
          "--plan/--spec/--findings read site lacks resolveDocArg (normalization entry closure missing a member)",
        file: f,
      });
    }
  }
  return hits;
}

// ⑤ Row 5: repo-wide zero old root-resolver names (the two-piece set, **including test sites**;
// post-move tests live in the src tree, so the scan explicitly enables includeTests — the scope is
// written `packages/cdd-engine/src`, never the deleted tests/ directory).
const CHANNEL_ROOT_TARGETS = [...ALL_MECH_POSITIONS, "scripts"];
const ROOT_RESOLVER_TOKENS = [
  {
    label: `${ROOT_FROM_DOC} regression (the old second authority guessing the root by path)`,
    re: new RegExp(ROOT_FROM_DOC),
  },
  {
    label: `${RESOLVE_REPO_ROOT} regression (old root-resolution function deleted wholesale)`,
    re: new RegExp(RESOLVE_REPO_ROOT),
  },
];
export function collectRootResolverHits(targetsOverride) {
  const targets = targetsOverride ?? CHANNEL_ROOT_TARGETS;
  const hits = [];
  for (const { label, re } of ROOT_RESOLVER_TOKENS) {
    for (const f of scanTargets(targets, re, { includeTests: true })) hits.push({ label, file: f });
  }
  return hits;
}

// ⑥ Row 6: zero test bypass seams (the filteredEnv / baseEnv / __*ForTest patch families). Post-move
// test sites live in the src tree — the scope is `packages/cdd-engine/src` (mechanism + test sites,
// includeTests on); the lib-side implementations no longer use these patterns, so the zero-hit holds
// on both faces (a mechanism-site hit also counts as a violation — retired patch vocabulary is not
// part of the engine body).
const TEST_SEAM_CHECKS = [
  { label: "filteredEnv patch pattern", re: /\bfilteredEnv\b/, scope: ["packages/cdd-engine/src"] },
  { label: "baseEnv patch pattern", re: /\bbaseEnv\b/, scope: ["packages/cdd-engine/src"] },
  { label: "__*ForTest seam", re: /__\w*ForTest\b/, scope: ["packages/cdd-engine/src"] },
];
export function collectTestSeamHits(targetsOverride) {
  const hits = [];
  for (const { label, re, scope } of TEST_SEAM_CHECKS) {
    for (const f of scanTargets(targetsOverride ?? scope, re, { includeTests: true }))
      hits.push({ label, file: f });
  }
  return hits;
}

// ⑦ Row 7 first half: zero hand-written handoff shapes — templates.ts keeps zero switch (the
// renderHandoffStub original hand-written schema-field inventory shape); finalize.ts writes to disk
// without an inline object literal, and the implement materialization write side must go through
// normalizeHandoff (the schema key set is the single authority, AC6). File scope is judged by
// basename (override lets tests inject).
export function collectHandoffShapeHits(
  filesOverride = [
    "packages/cdd-engine/src/render/templates.ts",
    "packages/cdd-engine/src/artifacts/handoff/finalize.ts",
  ],
) {
  const hits = [];
  for (const f of filesOverride) {
    const text = readFileSync(path.isAbsolute(f) ? f : path.join(ROOT, f), "utf8");
    const base = path.basename(f);
    if (base === "templates.ts" && /\bswitch\s*\(/.test(text)) {
      hits.push({
        label:
          "hand-written schema field inventory (renderHandoffStub's original switch shape regressed)",
        file: f,
      });
    }
    if (base === "finalize.ts") {
      if (/write(?:Own)?Handoff\([^,]+,\s*\{/.test(text)) {
        hits.push({
          label:
            "finalize write side inlines a hand-written handoff object literal (should go through schema / single-point construction)",
          file: f,
        });
      }
      if (!/\bnormalizeHandoff\b/.test(text)) {
        hits.push({
          label:
            "finalize materialization write side does not pass normalizeHandoff (schema key set no longer load-bearing)",
          file: f,
        });
      }
    }
  }
  return hits;
}

// ⑦ Row 7 second half: zero res.timedOut sole-dependency (AC6/AC7: the engine owns the timeout
// determination) — res.timedOut is never a standalone judgment condition (the judgment is
// spawnManaged's self-held combination), and the self-held signal clause
// (res.signal === "SIGTERM") must live in proc.mjs.
const TIMED_OUT_CONDITION_RE = /if\s*\(\s*!?\s*res\.timedOut\b/;
export function collectTimedOutSoleHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, TIMED_OUT_CONDITION_RE)) {
    hits.push({
      label: `res.timedOut as a standalone judgment condition (timeout judgment not self-held): ${text.trim().slice(0, 48)}`,
      file: `${file}:${lineNo}`,
    });
  }
  // P4.4 Task 4: spawnManaged (the self-held timeout judgment) moved into the CddRuntime class
  // (infra/runtime.ts — proc.ts is now a thin re-export); the clause guard pins the REAL home.
  const procFile = "packages/cdd-engine/src/infra/runtime.ts";
  const proc = readFileSync(path.join(ROOT, procFile), "utf8");
  if (!proc.includes('res.signal === "SIGTERM"')) {
    hits.push({
      label:
        "self-held timeout judgment missing (runtime.ts#spawnManaged lacks a res.signal === SIGTERM clause)",
      file: procFile,
    });
  }
  return hits;
}

// ⑧ Row 8: zero "write context to an arbitrary path" calls inside the engine (runtime context
// never lands on disk, AC4).
const CONTEXT_WRITE_RE =
  /write\w*Context\b|writeFileSync\([^)]*\bcontext\b|writeFileSync\([^,]+,\s*(?:JSON\.stringify\()?\s*(?:ctx|context)\.?/;
export function collectContextWriteHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo } of scanLines(targetsOverride, CONTEXT_WRITE_RE)) {
    hits.push({
      label: '"write context to an arbitrary path" call (runtime context never lands on disk)',
      file: `${file}:${lineNo}`,
    });
  }
  return hits;
}

// ⑨ Row 9: the Options face of `cdd <sub> --help` ⊆ canonical argv's flag set. -h/--help get no
// scan exemption (canonical explicitly declares help). Task 9 migrated to citty declarations —
// commander's program + helpInformation() text parsing went away with the parser: under citty the
// help OPTIONS face is defineCommand's args declaration (renderUsage generated from the
// declaration), so the guard walks the declaration tree directly for args keys (kebab → --flag),
// zero subprocesses. citty's built-in --help/-h is not a declared arg, appended per command into
// the flag set.
export function helpOptionFlags(argDef) {
  const flags = Object.keys(argDef ?? {}).map((key) => `--${key}`);
  flags.push("--help");
  return flags;
}

export function helpFlagsNotInCanonical(flags) {
  return flags.filter((f) => !CANONICAL_ARGV_FLAGS.has(f));
}

export function collectHelpFlagHits() {
  const hits = [];
  const stack = [[mainCommand, "cdd"]];
  while (stack.length > 0) {
    const [cmd, name] = stack.pop();
    for (const f of helpOptionFlags(cmd.args)) {
      if (!CANONICAL_ARGV_FLAGS.has(f)) {
        hits.push({
          label: `cdd ${name} --help Options carries a flag outside the canonical argv set: ${f}`,
          file: `cdd ${name} --help`,
        });
      }
    }
    for (const [sub, def] of Object.entries(cmd.subCommands ?? {})) {
      stack.push([def, `${name} ${sub}`]);
    }
  }
  return hits;
}

// ⑩ Row 10: zero hard-coding of canonical key names in lib/context.mjs — the flag / env / git fact
// names are compared item-by-item against the canonical full key-name set, zero literals (canonical
// is "load-bearing, not decorative"; this module only performs reads, AC4).
function canonicalFactTokens() {
  const toks = [];
  for (const a of Object.values(CONTRACT.channels.argv)) {
    if (a.flag) toks.push(a.flag);
    // review-1 nit: single-char short aliases (the -h shape) skip the bare includes — a two-char
    // substring would false-red on occasional hyphenated words like "-h1" / "-handler" in comments;
    // their long-name flag (--help) enters the tok set independently, so the guard keeps coverage.
    if (a.alias && !/^-[^-]$/.test(a.alias)) toks.push(a.alias);
  }
  for (const ch of Object.values(CONTRACT.channels.env)) {
    if (ch.var) toks.push(ch.var);
    for (const m of ch.markers ?? []) toks.push(m);
  }
  for (const g of Object.values(CONTRACT.channels.git)) {
    if (g.derivation) toks.push(g.derivation);
  }
  return toks.filter(Boolean);
}

export function collectContextModuleHardcodeHits(
  fileOverride = "packages/cdd-engine/src/infra/context.ts",
) {
  const abs = path.isAbsolute(fileOverride) ? fileOverride : path.join(ROOT, fileOverride);
  const text = readFileSync(abs, "utf8");
  const hits = [];
  for (const tok of canonicalFactTokens()) {
    if (text.includes(tok)) {
      hits.push({
        label: `src/infra/context.ts hard-codes a canonical fact name: ${tok} (load-bearing → decorative regression)`,
        file: fileOverride,
      });
    }
  }
  return hits;
}

// ⑪ Row 11: zero "derived value re-read as input through a residual file" call sites in engine
// src. The read-side fully-enumerated whitelist (progress counters · prev-round handoff — both
// explicit path parameters) is anchored on the load-bearing surface; the "most recent" scan
// vocabulary zero-hits.
// T14 whitelist (spec E3): the stall detector's workspace-tree probe in infra/proc.ts samples the
// newest-file mtime as a LIVE probe — a direct OS stat feeding the idle judge, not a derived-value
// residue re-read, so it sits outside the residue ban's intent. The brief mandates the signal and
// its acceptance gate is `pnpm run validate` green; per the guard's own `全枚举白名单`
// (fully-enumerated-whitelist) principle the
// carve-out is enumerated to THIS file only (same precedent as the naming.ts readdirSync whitelist).
// Every other residue token (latestHandoff/…) is still scanned inside proc.ts; any mtime/readdirSync
// use in any OTHER file still hits — pinned by the ⑪ selftest (incl. the golden temp-dir test).
const RESIDUAL_SCAN_RE =
  /latestHandoff|latestReview|latestRound|mostRecent|findLast|mtime|scanLatest|resolveLatest/i;
// P4.4 Task 4: the liveness probe (tree-mtime sampler + readdirSync walk) moved with the lifecycle
// into the CddRuntime class (infra/runtime.ts — proc.ts is a thin re-export).
const LIVENESS_PROBE_FILE = "packages/cdd-engine/src/infra/runtime.ts";
export function collectResidualRereadHits(targetsOverride = CDD_ENGINE_BIN) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, RESIDUAL_SCAN_RE)) {
    // T14 probe page: mtime-token lines are the sanctioned liveness sampler (whitelist above).
    if (file === LIVENESS_PROBE_FILE && /mtime/i.test(text)) continue;
    hits.push({
      label: `"most recent" residual re-read scan (read side must fully enumerate the whitelist): ${text.trim().slice(0, 48)}`,
      file: `${file}:${lineNo}`,
    });
  }
  const dirs = listTargetFiles(targetsOverride);
  for (const f of dirs) {
    const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
    if (!readFileSync(abs, "utf8").includes("readdirSync")) continue;
    if (f === "packages/cdd-engine/src/artifacts/handoff/naming.ts") continue;
    if (f === LIVENESS_PROBE_FILE) continue; // T14 probe page (whitelist enumerated above)
    // P2 T3: the four-table audit's doc-existence globs + anchor-registry scan enumerate the two
    // program doc dirs (specs/ + plans/, both explicit path arguments — never a full-tree find):
    // same fully-enumerated carve-out doctrine as the naming.ts whitelist (bounded dir listing in
    // the doc-contract judgment, not a "most recent" residue re-read).
    if (f === "packages/cdd-engine/src/rules/documents.ts") continue;
    hits.push({
      label:
        'readdirSync outside the whitelist (a directory scan in place of an explicit path argument is a "most recent" regression)',
      file: f,
    });
  }
  const rtFile = "packages/cdd-engine/src/dispatch/task.ts";
  const rt = readFileSync(path.join(ROOT, rtFile), "utf8");
  if (!rt.includes("prevHandoffPath")) {
    hits.push({
      label: "prev-round handoff explicit path read (prevHandoffPath) missing",
      file: rtFile,
    });
  }
  return hits;
}

// ⑫ Row 13: the stdout counters line derives from the canonical category table — the construction
// points keep zero hand-written counter names/labels; the six category names, "appearing as a
// category identity", keep zero hand-written sites (failure_category assignment /
// isIncompleteDispatch judgment); counters never enter the handoff contract. The properties count is
// iron-anchored by the guard: task 16 (14 base properties incl. failure_category + recovery +
// changes + the P4.3 single-data-model group reference tasks, T7.4/T7.5 carriers) / docs 14 (12 base
// properties incl. failure_category + recovery + changes, T7.4 carrier + the T5 commits{base,head}
// core-block unification). Nothing beyond recovery/changes/failure_category/commits + the P4.3
// group-reference fields (tasks / findings[].task) may be added. The four field names and labels go
// through failure-categories.json.
const COUNTER_FIELDS = failureResolver.counters().map((c) => c.field);
const COUNTER_LABELS = failureResolver.counters().map((c) => c.label);
const CATEGORY_IDS = Object.values(FAILURE_CATEGORIES).map((c) => c.id);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function collectCountersContractHits({
  constructFiles = [
    "packages/cdd-engine/src/artifacts/progress.ts",
    "packages/cdd-engine/src/rules/failure.ts",
  ],
  engineScope = CDD_ENGINE_BIN,
  taskSchema = "packages/cdd-engine/templates/schema/task-handoff-schema.json",
  docsSchema = "packages/cdd-engine/templates/schema/docs-handoff-schema.json",
} = {}) {
  const hits = [];
  // Construction points keep zero hand-writing: a double quote immediately followed by a counter
  // field name/H1 label is hand-writing ("timeoutCount=" and similar). Line-limited (line-by-line
  // scan, no cross-line span matching); \b anchors the label short names ("timeout" …) so the
  // semantic word "dispatch-timeout-cap" is not false-hit.
  const quoted = new RegExp(`"(${[...COUNTER_FIELDS, ...COUNTER_LABELS].map(escRe).join("|")})\\b`);
  for (const f of constructFiles) {
    const text = readFileSync(path.isAbsolute(f) ? f : path.join(ROOT, f), "utf8");
    const m = quoted.exec(text);
    if (m) {
      hits.push({ label: `counter name/label literal at a construction point: ${m[1]}`, file: f });
    }
  }
  // A category "appearing as a string literal" (the six category IDs as failure_category literal
  // values / isIncompleteDispatch literal args / incrementFailureCounter literal args; the status
  // enum values are not this class, hence no status key anchor). The category name list goes
  // through canonical.
  const failureCategoryRe = new RegExp(
    `failure_category:\\s*["'](?:${CATEGORY_IDS.map(escRe).join("|")})["']|isIncompleteDispatch\\(["']|incrementFailureCounter\\([^,]+,\\s*["']`,
  );
  for (const { file, lineNo, text } of scanLines(engineScope, failureCategoryRe)) {
    hits.push({
      label: `category appearing as a string literal (should go through FAILURE_CATEGORIES): ${text.trim().slice(0, 48)}`,
      file: `${file}:${lineNo}`,
    });
  }
  for (const [name, schemaPath] of [
    ["task", taskSchema],
    ["docs", docsSchema],
  ]) {
    const abs = path.isAbsolute(schemaPath) ? schemaPath : path.join(ROOT, schemaPath);
    const schema = JSON.parse(readFileSync(abs, "utf8"));
    const props = Object.keys(schema.properties ?? {});
    for (const fld of COUNTER_FIELDS) {
      if (props.includes(fld))
        hits.push({
          label: `counter ${fld} leaked into the ${name} handoff schema (counters never enter the contract)`,
          file: schemaPath,
        });
    }
    const expected = name === "task" ? 16 : 14;
    if (props.length !== expected || !props.includes("failure_category")) {
      hits.push({
        label: `${name} handoff schema properties count ${props.length} ≠ ${expected} (nothing may grow/shrink beyond failure_category)`,
        file: schemaPath,
      });
    }
  }
  return hits;
}

// Summary: row 14 ((?<!-)handoff-schema) belongs to T11 (collectHandoffSchemaHits, next section),
// not this group — 12 engine-side checks + a live-repo zero-residue assertion.
export function collectChannelAuditHits() {
  return [
    ...collectProcessCwdAudit(),
    ...collectEnvDirectReadHits(),
    ...collectEnvPassThroughHits(),
    ...collectEnvSpreadHits(),
    ...collectSixEnvKeyHits(),
    ...collectPathArgResolverHits(),
    ...collectRootResolverHits(),
    ...collectTestSeamHits(),
    ...collectHandoffShapeHits(),
    ...collectTimedOutSoleHits(),
    ...collectContextWriteHits(),
    ...collectHelpFlagHits(),
    ...collectContextModuleHardcodeHits(),
    ...collectResidualRereadHits(),
    ...collectCountersContractHits(),
  ];
}

export function checkChannelAudit() {
  const hits = collectChannelAuditHits();
  assert(
    hits.length === 0,
    `CHANNEL AUDIT FOUND — engine contract-surface guard (§2.8 rows 1-11, 13):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — channel audit (§2.8 rows 1-11, 13) zero violations");
}

// The guard surfaces' union (the wiring guard pins any scope shrink as a fail). Post-move
// `packages/cdd-engine/src` already contains the test sites; walkTargetFiles' default `__tests__`
// self-exemption applies (guard/test self-exemption doctrine) — CHANNEL_AUDIT_TARGETS no longer
// lists tests/ (retired directory), source paths only write src/... .
export const CHANNEL_AUDIT_TARGETS = [
  "packages/cdd-engine/src",
  "packages/cdd-engine/templates/schema",
  "packages/osuperpowers/skills",
  "scripts",
];

function checkStaleLexicon() {
  const hits = collectStaleLexiconHits();
  assert(
    hits.length === 0,
    `STALE LEXICON FOUND — mechanism positions (zero-exemption):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — stale-lexicon zero in mechanism positions");
}

function checkGateLexicon() {
  const hits = collectGateLexiconHits();
  assert(
    hits.length === 0,
    `GATE LEXICON FOUND — mechanism positions (zero-exemption):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — gate-lexicon zero in mechanism positions");
}

// =====================================================================
// Task 10 — init removal + version-stamp mechanism removal reverse guards (design §2.6.2 / §2.8 rows 19-20)
// =====================================================================
// ① The shipped non-emit surface (skills/** · plugin README — the contentRoot: "." publishing
// surface) keeps zero version literals (the osuperpowers-version stamp — the writer
// release/version-packages.ts and the reader validate/version-sync.ts were root-deleted, and the
// version truth converged to package.json + emit products); ② the shipped surface (root README.md ·
// plugin README) + the collaborator surface (.changeset/README.md) keep zero `/init` references
// (the marketplace install guide is inlined into the README install section — the `/init` entry
// does not exist). The scope is verbatim-identical to the §2.6.2 reverse-guard rows and §2.8 rows
// 19/20; `.changeset/README.md` is a collaborator surface (what publishes is packages/*/), so it
// stays out of the shipped assertion scope.
export const SHIPPED_SURFACE_TARGETS = [
  "packages/osuperpowers/skills",
  "packages/osuperpowers/README.md",
];
export const INIT_REFERENCE_TARGETS = [
  "README.md",
  "packages/osuperpowers/README.md",
  ".changeset/README.md",
];

// The stamp literal (the mechanism's sole carrier = the HTML-comment form
// `<!-- osuperpowers-version: X -->`; substring matching covers non-standard forms outside the
// comment — the same deletion-surface stance as R2's "sole carrier = skills/init/SKILL.md:6").
const VERSION_STAMP_RE = /osuperpowers-version/;
const INIT_REFERENCE_RE = /\/init/;

/** ① Shipped non-emit surface: zero version literals. targetsOverride lets tests inject temp targets. */
export function collectVersionStampHits(targetsOverride) {
  const hits = [];
  for (const f of scanTargets(targetsOverride ?? SHIPPED_SURFACE_TARGETS, VERSION_STAMP_RE)) {
    hits.push({
      label: "shipped non-emit surface version literal (the osuperpowers-version stamp)",
      file: f,
    });
  }
  return hits;
}

/** ② Shipped surface + collaborator surface: zero `/init` references. targetsOverride lets tests inject temp targets. */
export function collectInitReferenceHits(targetsOverride) {
  const hits = [];
  for (const f of scanTargets(targetsOverride ?? INIT_REFERENCE_TARGETS, INIT_REFERENCE_RE)) {
    hits.push({ label: "/init reference (shipped + collaborator surfaces)", file: f });
  }
  return hits;
}

/** Summary (shared by checkShippedGuards and tests): the two guards' hits { label, file } list. */
export function collectShippedGuardHits() {
  return [...collectVersionStampHits(), ...collectInitReferenceHits()];
}

function checkShippedGuards() {
  const hits = collectShippedGuardHits();
  assert(
    hits.length === 0,
    `SHIPPED GUARD FOUND — init/version-stamp mechanism reverse residue (§2.8 rows 19-20):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — shipped-surface guards (version literal + /init zero-residue)");
}

// =====================================================================
// Task 11 — handoff-schema.md removal reverse guard (design §2.8 row 14)
// =====================================================================
// `(?<!-)handoff-schema` zero-hit entry (row 14 is solely claimed by this task; the removal commits
// in the same commit as the guard): the bare-name form (e.g. a `// aligned with the … table` cite)
// and the path forms (`docs/handoff-schema.md` / `skills/cli-driven-development/
// docs/handoff-schema.md`) all hit; the negative lookbehind exempts the canonical schema filenames
// (`handoff-schema` in `task-handoff-schema.json` / `docs-handoff-schema.json` is always preceded by
// `-`). scope = packages/cdd-engine/src (walkTargetFiles' default `__tests__`
// self-exemption applies — test sites citing the deleted name are test assertions, the seam face,
// and tests no longer carry the engine-canonical pointer) + the whole packages/osuperpowers dir.
// This entry is not part of T8's collectChannelAuditHits (whose 12 checks mean §2.8 rows 1-11, 13);
// the row-21 task-review guard belongs to T15 Step 4b, not here. scripts/ is not in scope, so this
// file's written surface bears no self-hit risk.
export const HANDOFF_SCHEMA_TARGETS = [...CDD_ENGINE_BIN, "packages/osuperpowers"];
const HANDOFF_SCHEMA_RE = /(?<!-)handoff-schema/;

/** targetsOverride lets tests inject a temp directory; hits = { label, file } list. */
export function collectHandoffSchemaHits(targetsOverride) {
  const hits = [];
  for (const f of scanTargets(targetsOverride ?? HANDOFF_SCHEMA_TARGETS, HANDOFF_SCHEMA_RE)) {
    hits.push({
      label:
        "handoff-schema regression (deleted file/name; should point at the engine canonical schema JSON)",
      file: f,
    });
  }
  return hits;
}

function checkHandoffSchema() {
  const hits = collectHandoffSchemaHits();
  assert(
    hits.length === 0,
    `HANDOFF SCHEMA LEXICON FOUND — deleted handoff-schema.md path/name (§2.8 row 14):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — handoff-schema (§2.8 row 14) zero residue");
}

// =====================================================================
// Task 3 (P6) — .mjs terminal state + vitest memory-guard dual config (spec domain C, M5/M6)
// =====================================================================
// M5 (brief ⑤): `.mjs` terminal-state assertion — post-move src is always-truly 0 `.mjs` (48 test
// nodes + helpers + fixtures all converted to `.ts`; the 32→0 baseline is settled) + the tests/
// directory is retired at 0 files. Regex drift is thereby replaced by structural assertions: any
// `.mjs` re-appearance (engine product or test face) fails. `srcRootOverride` lets tests inject a
// temp src layout (the tests dir = a same-named `tests` under the src parent, verified pairwise
// with the override).
export function collectMjsTerminalStateViolations(srcRootOverride) {
  const srcRoot = srcRootOverride ?? path.join(ROOT, "packages/cdd-engine/src");
  const relBase = srcRootOverride ? srcRoot : ROOT;
  const out = [];
  for (const f of globSync("**/*.mjs", { cwd: srcRoot, absolute: true })) {
    out.push({
      label: "engine src .mjs regression (post-P6 the engine is all TS, the .mjs plane is zero)",
      file: path.relative(relBase, f),
    });
  }
  const testsDir = path.join(srcRoot, "..", "tests");
  if (existsSync(testsDir)) {
    out.push({
      label:
        "tests/ directory reappeared (Task 3 retired it; new tests land in src/<module>/__tests__)",
      file: "tests",
    });
  }
  return out;
}

function checkMjsTerminalState() {
  const hits = collectMjsTerminalStateViolations();
  assert(
    hits.length === 0,
    `MJS TERMINAL STATE VIOLATED — src always-truly 0 .mjs + tests/ 0 (P6 Task 3 ⑤):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — .mjs terminal state (src always-truly 0 .mjs, tests/ retired at 0)");
}

// M6 (brief ⑥): memory-guard recheck — the engine root + repo root dual vitest.config.mjs must
// hold maxWorkers=1 + fileParallelism=false + maxConcurrency=2 (converged after the 2026-09-17
// CPU-level fork-pool OOM; any divergence in either config is drift, pinned to the same values
// here). The presence assertion is conservative — passing when both carry the values.
const MEMORY_GUARD_INVARIANTS = [
  ["maxWorkers=1", "maxWorkers: 1"],
  ["fileParallelism=false", "fileParallelism: false"],
  ["maxConcurrency=2", "maxConcurrency: 2"],
];
const VITEST_CONFIGS = [
  ["packages/cdd-engine/vitest.config.mjs", "engine root"],
  ["vitest.config.mjs", "repo root"],
];
export function collectMemoryGuardViolations() {
  const out = [];
  for (const [rel, label] of VITEST_CONFIGS) {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    for (const [invariant, needle] of MEMORY_GUARD_INVARIANTS) {
      if (!text.includes(needle)) {
        out.push({
          label: `${label} vitest.config missing a memory guard ${invariant}`,
          file: rel,
        });
      }
    }
  }
  return out;
}

function checkMemoryGuard() {
  const hits = collectMemoryGuardViolations();
  assert(
    hits.length === 0,
    `MEMORY GUARD MISSING — vitest dual-config memory guard (P6 Task 3 ⑥):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log(
    "OK — memory-guard dual config (maxWorkers=1 / fileParallelism=false / maxConcurrency=2)",
  );
}

// =====================================================================
// Task 31 (P6, spec T7.10) — src comment anchor-first ban (§35 second half)
// =====================================================================
// §35's src-comment half: a comment's semantic body comes first; a phase anchor (P5 / T26 /
// Task 23 / spec T7.8…) is allowed only as a trailing traceability suffix, never as the comment's
// first valid token. The ban is enforced on every engine src comment — production AND test sites
// (a test file's prose is src comment prose too; the §35 rule makes no test carve-out, and
// walkTargetFiles' __tests__ self-exemption is a vocabulary-guard doctrine, not a comment-shape
// one). Carve-outs preserved verbatim:
//  ① file headers — a leading comment run whose first unit is path/module-led (anchors may sit in
//     trailing parens inside the header);
//  ② the anchor as a trailing suffix after the semantic body (… (T7.10) / … — T26) — the first
//     valid token is the semantic body's, so the family regex never matches;
//  ③ pure semantic prose (no anchor at all);
//  ④ the injection-surface zero-anchor guard (existing mechanism checks) — unchanged.
// A comment unit = one block comment, or a run of consecutive line comments (blank lines / code
// split runs). Continuation lines that complete an open paren written on the previous line are
// part of that run — judged by the run's first token, never their own. The header run = the
// file's leading units (before the first code token); it is exempt only when its FIRST unit's
// first valid token is not an anchor (a path/module-led header), so an anchor-led header stays
// a violation.
const ANCHOR_FAMILY_RE = /^(?:P\d+|T\d+(?:\.\d+)?|Task \d+|spec T\d+(?:\.\d+)?)\b/;
const SRC_COMMENT_TARGETS = ["packages/cdd-engine/src"];

// String/template-aware comment extraction: `//` and `/* */` outside string/template/regex
// surfaces only; the template-literal ${…} span is walked opaque (a nested compiler directive
// inside an interpolated string must not open a comment). Each unit carries inHeader (no code
// token seen before it) for the file-header carve-out.
function commentUnits(text) {
  const units = [];
  const newlineCount = (s) => (s.match(/\n/g) ?? []).length;
  let i = 0;
  let line = 1;
  let seenCode = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      const startLine = line;
      const eol = text.indexOf("\n", i);
      const end = eol === -1 ? n : eol;
      units.push({ kind: "line", startLine, content: text.slice(i + 2, end), inHeader: !seenCode });
      if (eol === -1) i = n;
      else {
        i = eol + 1;
        line += 1;
      }
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const startLine = line;
      const end = text.indexOf("*/", i + 2);
      const content = text.slice(i + 2, end === -1 ? n : end);
      units.push({ kind: "block", startLine, content, inHeader: !seenCode });
      line += newlineCount(content);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      seenCode = true;
      while (i < n) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === q) {
          i++;
          break;
        }
        if (text[i] === "\n") line++;
        i++;
      }
      continue;
    }
    if (c === "`") {
      i++;
      seenCode = true;
      while (i < n) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === "`") {
          i++;
          break;
        }
        if (text[i] === "$" && text[i + 1] === "{") {
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            // Mirror the outer string branches: a quote inside an interpolation is a quoted
            // span, not brace-bearing text — a {/} inside a string must not move the depth.
            if (text[i] === '"' || text[i] === "'" || text[i] === "`") {
              const q = text[i];
              i++;
              while (i < n) {
                if (text[i] === "\\") {
                  i += 2;
                  continue;
                }
                if (text[i] === q) {
                  i++;
                  break;
                }
                if (text[i] === "\n") line++;
                i++;
              }
              continue;
            }
            if (text[i] === "\n") line++;
            if (text[i] === "}") depth--;
            if (text[i] === "{") depth++;
            i++;
          }
          continue;
        }
        if (text[i] === "\n") line++;
        i++;
      }
      continue;
    }
    if (!/\s/.test(c)) seenCode = true;
    if (c === "\n") line++;
    i++;
  }
  return units;
}

// Consecutive line comments (adjacent source lines, same header membership) collapse into one
// unit; block comments are already one unit each. The first line carries the reported line.
function groupCommentUnits(units) {
  const grouped = [];
  for (const u of units) {
    const prev = grouped[grouped.length - 1];
    if (
      u.kind === "line" &&
      prev &&
      prev.kind === "line" &&
      prev.lines[prev.lines.length - 1] === u.startLine - 1 &&
      prev.inHeader === u.inHeader
    ) {
      prev.lines.push(u.startLine);
      prev.content += `\n${u.content}`;
      continue;
    }
    grouped.push({ ...u, lines: [u.startLine] });
  }
  return grouped;
}

// The comment's first valid token: block-comment `*` markers stripped per line, then leading
// delimiter punctuation (parens/brackets/dashes/colons/quotes…) skipped until the first word —
// the point at which a phase anchor would match the family regex.
function firstValidToken(unit) {
  let text =
    unit.kind === "block"
      ? unit.content
          .split("\n")
          .map((l) => l.replace(/^\s*\*\s?/, "").replace(/[ \t]+$/, ""))
          .join(" ")
          .trim()
      : unit.content.trim();
  while (text.length > 0 && /[([{\-_—–_#:;,.=!?+*|/?@'"`]|\s|（/.test(text[0])) {
    text = text.slice(1).trimStart();
  }
  return text;
}

/** targetsOverride lets tests inject a temp dir; hits = { label, file: path:line } list. */
export function collectCommentAnchorHits(targetsOverride) {
  const hits = [];
  for (const f of walkTargetFiles(targetsOverride ?? SRC_COMMENT_TARGETS, { includeTests: true })) {
    if (!f.endsWith(".ts")) continue; // the engine src plane is all TS (M5: the .mjs plane is zero)
    const src = readFileSync(f).toString("utf8");
    const units = groupCommentUnits(commentUnits(src));
    const header = units.filter((u) => u.inHeader);
    const body = units.filter((u) => !u.inHeader);
    const headerExempt = header.length > 0 && !ANCHOR_FAMILY_RE.test(firstValidToken(header[0]));
    for (const u of headerExempt ? body : units) {
      if (ANCHOR_FAMILY_RE.test(firstValidToken(u))) {
        hits.push({
          label: `src comment opens with a phase anchor (semantic body first, §35): ${firstValidToken(u).slice(0, 56)}`,
          file: `${path.relative(ROOT, f)}:${u.lines[0]}`,
        });
      }
    }
  }
  return hits;
}

function checkCommentAnchors() {
  const hits = collectCommentAnchorHits();
  assert(
    hits.length === 0,
    `SRC COMMENT ANCHOR FOUND — engine src comments must be semantic-first (§35 second half, T7.10):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — src comment anchor-first ban (§35 second half) zero violations");
}

// =====================================================================
// Task 16 — skills-surface guard (design §2.8 rows 12/15/16/17/18; the skills-side landings of
// AC5/AC11/AC14)
// =====================================================================
// The five guards merge into collectSkillSurfaceHits() (isomorphic to T8's
// collectChannelAuditHits()), folded into the existing 5c step by checkSkillSurface() (block count
// unchanged). Every guard scope sits inside packages/osuperpowers/skills/; scripts/ is in no
// scope — the guard body is not a carrier of the vocabulary it guards.
//   Row 17 — zero upstream-document read (\bvendors\/ · \bsuperpowers\/.*SKILL\.md · Read[- ]Upstream ·
//            \bread upstream\b) + every upstream reference takes the `/<plugin>:<skill>` slash form
//            (an upstream plugin:skill reference without a slash prefix → hit; a same-plugin
//            `osuperpowers:` reference is not upstream).
//   Row 15 — zero engine-internal-structure dependency (\bCDD_[A-Z_]+\b · \bprogress\.json\b ·
//            task-\d+-(review|fix|implement)-\d*\.?json). scope = design AC5's 7 orchestrator
//            skills enumerated by name (see ORCHESTRATOR_SKILLS). report-issues is explicitly
//            excluded — AC5 verbatim quote: 「例外（设计内，非缺口）：
//            report-issues 的 progress.json#plan 读取是 program 通道的首跳（§2.5.4 的目的正是使其
//            可用），不属「引擎内部结构依赖」——该处的去留归 P5 的目标流程（届时可改指命令输出
//            契约）」. The exclusion applies only to this entry; report-issues remains in the skills-
//            surface scope of the other 4 entries in this group (measured zero-hit on CDD_* /
//            fix-inline / vendors/ / _docs/). The 7-name enumeration (including finishing, not 6)
//            is a verbatim same-source inventory — a skills/** wildcard is not allowed to cover it:
//            a wildcard would make the guard unreachable on report-issues and miss future new
//            skills.
//   Row 16 — zero fix-inline (fixes always take the `cdd fix` form, §2.7.3); and every review-loop
//            fix node (a mermaid node whose label contains fix — fix-task / branch-fix / fix-spec /
//            fix-plan) must have its `### `label`` section contain the `cdd fix` command form.
//   Row 12 — ① the first column of cli-driven-development/SKILL.md's `## Failure Modes` short table
//            ⊆ the canonical category set (FAILURE_CATEGORIES, taken here via cdd-engine's single
//            read entry, never a second literal copy) ∪ the handoff status-enum whitelist
//            (declaration point = task-handoff-schema.json's status.enum; defensive pass-through,
//            and it is a separate declaration from failure_category's enum — TIMEOUT's name
//            overlap does not constitute a category identity);
//            ② category semantics zero rephrase — engineRecoveryCount / countsTowardConvergence /
//            dispatch-timeout-cap / the `计入 Convergence` wording all zero-hit on the skills
//            surface (skills may only cite category names).
//   Row 18 — zero _docs/ references (\b_docs\/ path form + rule-review-convergence anchor/bare
//            mention) — the permanent guard for T15's one-time deletion; scope is exactly the
//            skills surface (not extended to the engine injection / governance entry surfaces).
export const ORCHESTRATOR_SKILLS = [
  "packages/osuperpowers/skills/brainstorming/SKILL.md",
  "packages/osuperpowers/skills/writing-single-spec/SKILL.md",
  "packages/osuperpowers/skills/writing-overall-spec/SKILL.md",
  "packages/osuperpowers/skills/writing-phase-spec/SKILL.md",
  "packages/osuperpowers/skills/writing-plans/SKILL.md",
  "packages/osuperpowers/skills/cli-driven-development/SKILL.md",
  "packages/osuperpowers/skills/finishing/SKILL.md",
];
const CDD_SKILL = "packages/osuperpowers/skills/cli-driven-development/SKILL.md";

// Negative vocabulary uses the "token form" rather than the "slash-prefixed form": the historical
// violation shapes are backtick/whitespace-led path references (`vendors/mattpocock-skills/…` ·
// `_docs/review.md`), which a `/`-prefixed regex would let through; \b (_ is a word char) still
// refuses false hits on hyphenated derived words (e.g. svendors/).
const UPSTREAM_READ_RE =
  /\bvendors\/|\bsuperpowers\/.*SKILL\.md|Read[- ]Upstream|\bread upstream\b/i;
const UPSTREAM_REF_SLASH_RE = /(?<!\/)\b(?:superpowers|mattpocock-skills|impeccable):[a-z0-9-]+\b/;
const INTERNAL_DEP_RE =
  /\bCDD_[A-Z_]+\b|\bprogress\.json\b|task-\d+-(?:review|fix|implement)-\d*\.?json/;
const FIX_INLINE_RE = /fix-inline/;
const FAILURE_SEMANTICS_RE =
  /engineRecoveryCount|countsTowardConvergence|dispatch-timeout-cap|计入\s*Convergence/;
const DOCS_REF_RE = /\b_docs\/|rule-review-convergence/;

/** Handoff status-enum whitelist (declaration point = task-handoff-schema.json's status.enum;
 *  defensive pass-through). */
function handoffStatusWhitelist() {
  const schema = JSON.parse(
    readFileSync(
      path.join(ROOT, "packages/cdd-engine/templates/schema/task-handoff-schema.json"),
      "utf8",
    ),
  );
  return new Set(schema.properties.status.enum ?? []);
}

/** Row 12 ① extraction: the first column of the `## Failure Modes` short table (§2.5.2 derivation
 *  channel ②'s sole consumer = cli-driven-development; the extraction surface is the adjudication
 *  surface — the implementation must not invent its own scan surface). */
export function failureModeCandidates(skillText) {
  const candidates = [];
  const lines = skillText.split("\n");
  let inSection = false;
  let afterHeader = false;
  for (const line of lines) {
    if (/^## /.test(line)) {
      if (inSection) break;
      inSection = /^## Failure Modes\b/.test(line);
      continue;
    }
    if (!inSection) continue;
    const t = line.trim();
    if (t.startsWith("|") && t !== "|") {
      if (afterHeader) {
        const cell = t.split("|")[1]?.trim();
        if (cell) candidates.push(cell);
      } else {
        // markdown separator rows (|---|---| and | --- |): after stripping | and whitespace, only
        // -/:/* remain — that is a separator row.
        const stripped = t.replace(/\|/g, "").trim();
        if (stripped !== "" && /^[\s:*-]+$/.test(stripped)) afterHeader = true;
      }
    }
  }
  return candidates;
}

/** Row 12 ① failure-category-name set ⊆ canonical category set ∪ status-enum whitelist.
 *  fileOverride lets tests inject a temp file. */
export function collectFailureModeCategoryHits(fileOverride = CDD_SKILL) {
  const abs = path.isAbsolute(fileOverride) ? fileOverride : path.join(ROOT, fileOverride);
  const text = readFileSync(abs, "utf8");
  const allowed = new Set([
    ...Object.values(FAILURE_CATEGORIES).map((c) => c.id),
    ...handoffStatusWhitelist(),
  ]);
  const hits = [];
  for (const cand of failureModeCandidates(text)) {
    if (!allowed.has(cand)) {
      hits.push({
        label: `failure-category name not in canonical (§2.8 row 12): ${cand}`,
        file: fileOverride,
      });
    }
  }
  return hits;
}

/** Row 12 ② category semantics zero rephrase (skills surface; skills may only cite category names). */
export function collectFailureModeSemanticsHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, FAILURE_SEMANTICS_RE)) {
    hits.push({
      label: `category semantics rephrase (skills may only cite category names): ${text.trim().slice(0, 48)}`,
      file: `${file}:${lineNo}`,
    });
  }
  return hits;
}

/** Row 17 (negative): zero upstream-document read (skills surface). */
export function collectUpstreamReadHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const f of scanTargets(targetsOverride, UPSTREAM_READ_RE)) {
    hits.push({
      label: "upstream-document read regression (vendors/ · upstream SKILL.md · Read-Upstream)",
      file: f,
    });
  }
  return hits;
}

/** Row 17 (positive): every upstream reference takes the `/plugin:skill` slash form (skills
 *  surface; a same-plugin `osuperpowers:` reference is not upstream). */
export function collectUpstreamSlashFormHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const { file, lineNo, text } of scanLines(targetsOverride, UPSTREAM_REF_SLASH_RE)) {
    hits.push({
      label: `upstream reference not in the /plugin:skill slash form: ${text.trim().slice(0, 48)}`,
      file: `${file}:${lineNo}`,
    });
  }
  return hits;
}

/** Row 15: zero engine-internal-structure dependency. filesOverride = the 7 orchestrator skills'
 *  explicit file list (tests inject temp files). */
export function collectInternalDependencyHits(filesOverride = ORCHESTRATOR_SKILLS) {
  const hits = [];
  for (const f of scanTargets(filesOverride, INTERNAL_DEP_RE)) {
    hits.push({
      label:
        "orchestrator skill engine-internal-structure dependency (CDD_* · progress.json · handoff filenames)",
      file: f,
    });
  }
  return hits;
}

/** Row 16 (negative): zero fix-inline (skills surface). */
export function collectFixInlineHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const f of scanTargets(targetsOverride, FIX_INLINE_RE)) {
    hits.push({
      label: "fix-inline regression (fixes always take the cdd fix form, §2.7.3)",
      file: f,
    });
  }
  return hits;
}

/** mermaid node labels containing "fix" (the review-loop fix-node shapes: fix-task / branch-fix /
 *  fix-spec / fix-plan). */
function extractFixNodeLabels(src) {
  const m = src.match(/```mermaid\n([\s\S]*?)```/);
  if (!m) return [];
  const labels = [];
  for (const lm of m[1].matchAll(/(\w+)\[([^\]]+)\]/g)) {
    const label = lm[2].trim();
    if (/\bfix\b/.test(label)) labels.push(label);
  }
  return labels;
}

/** Row 16 (positive): for each review-loop fix node (mermaid label contains fix), its
 *  `### `label`` section must contain `cdd fix`. */
export function collectReviewLoopFixCddHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const f of walkTargetFiles(targetsOverride)) {
    if (!f.endsWith("SKILL.md")) continue;
    const src = readFileSync(f).toString("utf8");
    for (const label of extractFixNodeLabels(src)) {
      const lines = src.split("\n");
      const head = `### \`${label}\``;
      const start = lines.indexOf(head);
      if (start === -1) {
        hits.push({
          label: `review-loop node ${label} missing its ### section (digraph declares it)`,
          file: path.relative(ROOT, f),
        });
        continue;
      }
      const section = [];
      // Section boundary takes /^#{1,3} / (stop at ###): the following ### `node` sections inside the
      // same ## block are adjacent nodes, not this node's prose — if the cut were only on ##, a
      // preceding fix node missing cdd fix would be masked to green by the following (cdd-fix-
      // containing) fix node's section content (review-1 nit).
      for (let i = start + 1; i < lines.length; i++) {
        if (/^#{1,3} /.test(lines[i])) break;
        section.push(lines[i]);
      }
      if (!/cdd fix/.test(section.join("\n"))) {
        hits.push({
          label: `review-loop node ${label} lacks the cdd fix command form (§2.8 row 16)`,
          file: path.relative(ROOT, f),
        });
      }
    }
  }
  return hits;
}

/** Row 18: zero _docs/ references (skills surface; the permanent guard for T15's one-time
 *  deletion). */
export function collectDocsRefHits(targetsOverride = OSKILLS) {
  const hits = [];
  for (const f of scanTargets(targetsOverride, DOCS_REF_RE)) {
    hits.push({
      label:
        "_docs/ reference regression (incl. the rule-review-convergence anchor/bare mention, §2.8 row 18)",
      file: f,
    });
  }
  return hits;
}

/** Summary (shared by checkSkillSurface and tests): the five skills-surface guards' hits
 *  { label, file } list. */
export function collectSkillSurfaceHits() {
  return [
    ...collectUpstreamReadHits(),
    ...collectUpstreamSlashFormHits(),
    ...collectInternalDependencyHits(),
    ...collectFixInlineHits(),
    ...collectReviewLoopFixCddHits(),
    ...collectFailureModeCategoryHits(),
    ...collectFailureModeSemanticsHits(),
    ...collectDocsRefHits(),
  ];
}

function checkSkillSurface() {
  const hits = collectSkillSurfaceHits();
  assert(
    hits.length === 0,
    `SKILL SURFACE FOUND — skills-surface guard (§2.8 rows 12/15/16/17/18):\n  ${hits.map((h) => `[${h.label}] ${h.file}`).join("\n  ")}`,
  );
  console.log("OK — skills-surface guard (§2.8 rows 12/15/16/17/18) zero violations");
}

// Block count unchanged (11): checkStaleLexicon and T6's checkGateLexicon fold into the existing
// 5c.run step internally — first checkZeroResidue, then checkStaleLexicon, then checkGateLexicon;
// T8 appends checkChannelAudit (§2.8 rows 1-11, 13; the engine-side 12 checks); T10 appends
// checkShippedGuards (§2.8 rows 19-20; the two shipped-surface reverse guards); T11 appends
// checkHandoffSchema (§2.8 row 14; the zero-hit guard); T16 appends checkSkillSurface (§2.8 rows
// 12/15/16/17/18; the five skills-surface guards); Task 3 (P6) appends checkMjsTerminalState
// (M5: .mjs terminal state) and checkMemoryGuard (M6: vitest dual-config memory guard);
// Task 31 (P6, spec T7.10) appends checkCommentAnchors (§35 second half: the src comment
// anchor-first ban — semantic body first, anchor only as a trailing traceability suffix);
// grepTargets grew to include cdd-engine src+templates for the wiring guard to pin. channelTargets
// = the channel-audit guard-surface union (the wiring guard pins any scope shrink as a fail;
// post-move it excludes the retired tests/, the src surface walk self-exempts).
export const steps = [
  {
    name: "engine zero residue + channel audit",
    run: () => {
      checkZeroResidue();
      checkStaleLexicon();
      checkGateLexicon();
      checkChannelAudit();
      checkShippedGuards();
      checkHandoffSchema();
      checkSkillSurface();
      checkMjsTerminalState();
      checkMemoryGuard();
      checkCommentAnchors();
    },
    grepTargets: RESIDUE_TARGETS,
    channelTargets: CHANNEL_AUDIT_TARGETS,
  },
];

runIfMain(import.meta.url, steps);
