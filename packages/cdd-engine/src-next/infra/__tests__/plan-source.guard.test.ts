// packages/cdd-engine/src-next/infra/__tests__/plan-source.guard.test.ts
// The doc-type constructor-site gate: a doc key's construction spelling — `new`
// plus that doc type's class name plus the key literal — is legal at exactly TWO
// places: its own registration row in `contract/doc.ts`, and the one read point the
// doc type designates (the plan's is `infra/plan-source.ts`). The rule is general,
// not plan-specific: the registry (`docTypeParsers`) is the parameter source, so a
// newly registered doc type joins the scan surface with no edit to this gate.
//
// The scan reads the engine's production TypeScript with `**/__tests__/**`
// excluded — a test legitimately constructs a parser directly. Comments are
// stripped first (a commented spelling is prose, not a site) while string
// interiors survive, so the key literal is matched as written.
//
// The judgement is one executable fact: `grep -rn 'new PlanDocType("plan")'
// packages/cdd-engine/src-next | grep -v __tests__` leaves the registry row and
// `infra/plan-source.ts`, one occurrence each. This gate states that as an
// equality, so a reintroduced second read point — `render/brief.ts`'s retired
// parser collaborator included — turns it red instead of passing silently.
//
// Second gate: `infra/plan-source.ts` carries no empty `catch` block (a swallowed
// parse failure would read as a healthy plan).
//
// Zero module-level bare functions — every helper is an arrow const or a class.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "../../__tests__/support/strip-comments.ts";
import { docTypeParsers } from "../../contract/doc.ts";

/** `src-next/` — every scanned path resolves against the engine source root. */
const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The registry file: a doc key's own row is the first legal construction site. */
const REGISTRY_FILE = "contract/doc.ts";

/** The designated read point per doc key. An unlisted key has no second site — the
 *  registry row is its only legal construction. */
const READ_SITES: Readonly<Record<string, string>> = { plan: "infra/plan-source.ts" };

/** The plan read seam — the file whose `catch` blocks this gate judges. */
const PLAN_SOURCE_FILE = "infra/plan-source.ts";

interface SourceFile {
  readonly rel: string;
  readonly text: string;
}

interface Hit {
  readonly file: string;
  readonly count: number;
}

interface Violation extends Hit {
  readonly key: string;
}

/** The scan surface: every engine TypeScript file under `src-next`, comments
 *  stripped, one deterministic file order. The `__tests__` exclusion belongs to the
 *  guard (below), so a fixture can prove it. */
const loadSources = (): SourceFile[] =>
  readdirSync(SRC_ROOT, { recursive: true, encoding: "utf8" })
    .filter((rel) => rel.endsWith(".ts"))
    .map((rel) => ({ rel, text: stripComments(readFileSync(`${SRC_ROOT}${rel}`, "utf8")) }))
    .sort((left, right) => left.rel.localeCompare(right.rel));

/**
 * The constructor-site gate. It takes its doc-key domain from a parser registry
 * (production: `docTypeParsers`; a test may pass a synthetic registry to prove the
 * parameterisation), its scan surface from injected source files, and its second
 * legal site from the read-site table.
 */
class ConstructorSiteGuard {
  readonly #parsers: Readonly<Record<string, object>>;
  readonly #sources: readonly SourceFile[];
  readonly #readSites: Readonly<Record<string, string>>;

  constructor(
    parsers: Readonly<Record<string, object>>,
    sources: readonly SourceFile[],
    readSites: Readonly<Record<string, string>> = READ_SITES,
  ) {
    this.#parsers = parsers;
    // Production source only: a test may legitimately construct a parser directly.
    this.#sources = sources.filter((file) => !file.rel.split("/").includes("__tests__"));
    this.#readSites = readSites;
  }

  /** The registered doc keys — the scan domain, straight from the registry. */
  keys(): string[] {
    return Object.keys(this.#parsers).sort();
  }

  /** The doc type's class name — read off the registered instance, never re-typed. */
  classNameOf(key: string): string {
    return (this.#parsers[key] as { constructor: { name: string } }).constructor.name;
  }

  /** The files where one key's construction spelling is legal. */
  allowedOf(key: string): string[] {
    const read = this.#readSites[key];
    return read === undefined ? [REGISTRY_FILE] : [REGISTRY_FILE, read];
  }

  /** Every file on the scan surface that spells one key's construction, with counts. */
  hitsOf(key: string): Hit[] {
    const pattern = this.#spellingOf(key);
    return this.#sources
      .map((file) => ({ file: file.rel, count: [...file.text.matchAll(pattern)].length }))
      .filter((hit) => hit.count > 0);
  }

  /** Every construction site outside the legal set — the gate's red face. */
  violations(): Violation[] {
    return this.keys().flatMap((key) => {
      const allowed = this.allowedOf(key);
      return this.hitsOf(key)
        .filter((hit) => !allowed.includes(hit.file))
        .map((hit) => ({ ...hit, key }));
    });
  }

  /** The empty `catch` blocks in one file (comments already stripped). */
  emptyCatchCount(rel: string): number {
    const file = this.#sources.find((candidate) => candidate.rel === rel);
    expect(file, rel).toBeDefined();
    return [...(file?.text ?? "").matchAll(/\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g)].length;
  }

  /** The construction spelling for one key: `new <ClassName>("<key>")`. */
  #spellingOf(key: string): RegExp {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const spelling = `\\bnew\\s+${this.classNameOf(key)}\\s*\\(\\s*(["'\`])${escapedKey}\\1\\s*,?\\s*\\)`;
    return new RegExp(spelling, "g");
  }
}

/** The synthetic registry class — a doc type this gate has never heard of. */
class RoadmapDocType {
  readonly docTypeName = "roadmap" as const;
}

const guard = new ConstructorSiteGuard(docTypeParsers, loadSources());

const fixture = (rel: string, text: string): SourceFile => ({ rel, text: stripComments(text) });

describe("the doc-type constructor-site gate (one registry row + one read point)", () => {
  it("is parameterized by the registry — every registered key is scanned", () => {
    // The domain comes from `docTypeParsers`, never a re-typed key list; the class
    // name comes off each registered instance.
    expect(guard.keys()).toEqual(Object.keys(docTypeParsers).sort());
    for (const key of guard.keys()) {
      expect(guard.classNameOf(key), key).toMatch(/DocType$/);
    }
  });

  it("takes a newly registered doc type into the scan surface with no guard edit", () => {
    const parsers = { ...docTypeParsers, roadmap: new RoadmapDocType() };
    const sources = [
      fixture(REGISTRY_FILE, 'const parsers = { roadmap: new RoadmapDocType("roadmap") };'),
      fixture("face/cli.ts", 'const second = new RoadmapDocType("roadmap");'),
    ];
    const violations = new ConstructorSiteGuard(parsers, sources).violations();
    // The unregistered-before key is judged by the same rule: its second site is red.
    expect(violations).toEqual([{ key: "roadmap", file: "face/cli.ts", count: 1 }]);
  });

  it("spells each doc key's construction only at its registry row and designated read point", () => {
    // The equality is the judgement line: the plan leaves exactly the two sites,
    // one occurrence each; every other doc type leaves only its registry row.
    for (const key of guard.keys()) {
      const expected = guard.allowedOf(key).map((file) => ({ file, count: 1 }));
      expect(guard.hitsOf(key), key).toEqual(expected);
    }
    expect(guard.violations()).toEqual([]);
  });

  it("puts the plan's legal sites at the registry row and infra/plan-source.ts — never render/brief.ts", () => {
    const sites = guard.hitsOf("plan").map((hit) => hit.file);
    expect(sites).toEqual([REGISTRY_FILE, PLAN_SOURCE_FILE]);
    // The retired second parse: the brief renders a PlanRead, it never constructs one.
    expect(sites).not.toContain("render/brief.ts");
  });

  it("excludes **/__tests__/** — a parser built in a test is not a production site", () => {
    const sources = [fixture("infra/__tests__/plan-source.test.ts", 'new PlanDocType("plan")')];
    expect(new ConstructorSiteGuard(docTypeParsers, sources).violations()).toEqual([]);
  });

  it("turns red on an out-of-bounds spelling — the fixture proves the gate fails", () => {
    // A fixture spelling the retired site shape: a second `new PlanDocType("plan")`
    // in a production file. The gate must name it, not pass it.
    const sources = [
      fixture(REGISTRY_FILE, 'plan: new PlanDocType("plan"),'),
      fixture(PLAN_SOURCE_FILE, 'readonly #parser = new PlanDocType("plan");'),
      fixture("render/brief.ts", 'const parser = new PlanDocType("plan");'),
    ];
    const violations = new ConstructorSiteGuard(docTypeParsers, sources).violations();
    expect(violations).toEqual([{ key: "plan", file: "render/brief.ts", count: 1 }]);
  });

  it("counts a commented spelling as prose, not a site", () => {
    const sources = [
      fixture(REGISTRY_FILE, 'plan: new PlanDocType("plan"),'),
      fixture(PLAN_SOURCE_FILE, 'readonly #parser = new PlanDocType("plan");'),
      fixture("render/brief.ts", '// the old shape: new PlanDocType("plan")'),
    ];
    expect(new ConstructorSiteGuard(docTypeParsers, sources).violations()).toEqual([]);
  });

  it("carries no empty catch block in infra/plan-source.ts", () => {
    // A swallowed throw would turn a grammar break into a healthy-looking plan.
    expect(guard.emptyCatchCount(PLAN_SOURCE_FILE)).toBe(0);
  });

  it("recognises an empty catch on the fixture — the same predicate can fail", () => {
    const sources = [
      fixture(
        PLAN_SOURCE_FILE,
        "try { this.#classify(path); } catch {\n}\ntry { work(); } catch (error) {\n  throw error;\n}",
      ),
    ];
    expect(
      new ConstructorSiteGuard(docTypeParsers, sources).emptyCatchCount(PLAN_SOURCE_FILE),
    ).toBe(1);
  });
});
