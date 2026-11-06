// packages/cdd-engine/src-next/session/__tests__/doc-revision-body.test.ts
// P26 T1 (spec §1.2–§1.4, acceptance 1–3) — the doc-revision drift behaviour on the
// BODY basis:
//   · plan and phase-spec: a bookkeeping-only write (version bump + an appended
//     change-history line) keeps `doc_hash` identical, a body sentence edit moves it;
//   · the branch line (whose reviewed identity IS its plan's doc-revision) and the
//     plan line each reproduce the interlock: bookkeeping ⇒ `same`, a task-body edit
//     ⇒ `drift`;
//   · the single-definition gate: `ReviewRefs#docRevision` is the ONLY site hashing
//     document content, and it hashes the `contract/` projection — `session/` never
//     slices the body itself, `briefRevision` never touches the projection.

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ConfigLoader } from "../../infra/config.ts";
import { Workspace, WorkspaceRoot } from "../../infra/workspace.ts";
import { Ledger } from "../ledger.ts";

/** One document shape, parameterized the way a bookkeeping edit moves it. */
const docOf = (type: "plan" | "phase-spec", version: string, history: string, task: string) =>
  [
    "---",
    `title: ${type} sample`,
    `doc-type: ${type}`,
    `version: ${version}`,
    "---",
    "",
    "## Constraints",
    "",
    "- keep the face narrow",
    "",
    "### Task 1: A",
    "",
    task,
    "",
    "## Change history",
    "",
    `- ${history}`,
    "",
  ].join("\n");

const BOOKKEEPING = (type: "plan" | "phase-spec") => ({
  before: docOf(type, "v0.1", "v0.1 initial", "do the thing"),
  after: docOf(type, "v0.2", "v0.2 bookkeeping only", "do the thing"),
  edited: docOf(type, "v0.2", "v0.2 bookkeeping only", "do the other thing"),
});

/** A hermetic ledger fixture — a fresh temp workspace under a temp repo root. */
const fixture = (): { ledger: Ledger; workspace: Workspace; cleanup: () => void } => {
  const repo = mkdtempSync(path.join(tmpdir(), "doc-revision-body-"));
  const workspace = new Workspace(
    new WorkspaceRoot(path.join(repo, ".kairos", "cdd"), "session"),
    "test-slug",
  );
  const ledger = new Ledger(workspace, new ConfigLoader());
  return { ledger, workspace, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
};

/** Write one document under `docs/` and return its absolute path. */
const writeDoc = (workspace: Workspace, name: string, content: string): string => {
  const doc = path.join(workspace.path, "docs", name);
  mkdirSync(path.dirname(doc), { recursive: true });
  writeFileSync(doc, content, "utf8");
  return doc;
};

describe("doc-revision hashes the body only (spec §1.2)", () => {
  for (const type of ["plan", "phase-spec"] as const) {
    it(`${type}: a bookkeeping write keeps doc_hash; a body edit moves it`, () => {
      const { ledger, cleanup } = fixture();
      try {
        const samples = BOOKKEEPING(type);
        const at = (content: string) => ledger.refs().docRevision(`docs/${type}.md`, content);
        expect(at(samples.after).doc_hash).toBe(at(samples.before).doc_hash);
        expect(at(samples.edited).doc_hash).not.toBe(at(samples.before).doc_hash);
      } finally {
        cleanup();
      }
    });
  }
});

describe("the interlock — bookkeeping is `same`, body drift is `drift`", () => {
  for (const line of [
    { key: "branch", identity: "branch" as const },
    { key: "plan", identity: "plan" as const },
  ]) {
    it(`${line.key} line: the reviewed plan's bookkeeping does not reopen, its body edit does`, () => {
      const { ledger, workspace, cleanup } = fixture();
      try {
        const samples = BOOKKEEPING("plan");
        // The reviewed identity is the plan's doc-revision on the reviewed body.
        const doc = writeDoc(workspace, "plan.md", samples.before);
        ledger.recordReviewedRevision(
          line.key,
          ledger.refs().docRevision(doc, samples.before),
          line.identity,
        );
        // bookkeeping-only write — the reviewed line stays `same` (no spurious reopen)
        writeFileSync(doc, samples.after, "utf8");
        expect(ledger.docLineVerdict(line.key, doc, line.identity)).toBe("same");
        // a task-body edit — the reviewed line drifts
        writeFileSync(doc, samples.edited, "utf8");
        expect(ledger.docLineVerdict(line.key, doc, line.identity)).toBe("drift");
      } finally {
        cleanup();
      }
    });
  }
});

describe("single definition — one hash site, the contract projection (spec §1.3)", () => {
  const sessionRoot = fileURLToPath(new URL("..", import.meta.url));
  const ledgerSource = readFileSync(path.join(sessionRoot, "ledger.ts"), "utf8");

  it("`session/ledger.ts` hashes document content at exactly ONE site", () => {
    const sites = ledgerSource.match(/createHash\(/g) ?? [];
    expect(sites.length).toBe(1);
  });

  it("that one site lives in `ReviewRefs` and consumes the `contract/` projection", () => {
    const classAt = ledgerSource.indexOf("export class ReviewRefs");
    const hashAt = ledgerSource.indexOf('createHash("sha1")');
    expect(classAt).toBeGreaterThan(-1);
    expect(hashAt).toBeGreaterThan(classAt);
    // the projection is applied inside `docRevision`, and `briefRevision` is untouched
    const docRevision = ledgerSource.slice(
      ledgerSource.indexOf("docRevision(doc: string, content: string | Buffer)"),
      ledgerSource.indexOf("briefRevision(plan: string, briefContent: string | Buffer)"),
    );
    expect(docRevision).toContain("DocBodyProjection");
    const briefRevision = ledgerSource.slice(
      ledgerSource.indexOf("briefRevision(plan: string, briefContent: string | Buffer)"),
      ledgerSource.indexOf("sameRef(a: ReviewedRevisionRef"),
    );
    expect(briefRevision).not.toContain("DocBodyProjection");
  });

  it("no other `session/` module slices or hashes the document body itself", () => {
    const files = readdirSync(sessionRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && entry.name !== "ledger.ts")
      .map((entry) => entry.name);
    for (const file of files) {
      const source = readFileSync(path.join(sessionRoot, file), "utf8");
      expect(source, `${file} carries a second hash site`).not.toMatch(/createHash\(/);
      expect(source, `${file} slices the doc body itself`).not.toContain("DocBodyProjection(");
    }
  });
});
