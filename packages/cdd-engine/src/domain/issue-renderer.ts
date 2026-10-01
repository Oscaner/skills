// packages/cdd-engine/src/domain/issue-renderer.ts — IssueReportRenderer: the aggregate-issue-body
// renderer (P4.2 Task 6: migrated from packages/kairos/scripts/report-templates.mjs, the
// template authority moved to templates/report/issue-body.json). Single renderer over the canonical
// finding-meta plane:
//   · the template is loaded once and memoized on the instance (methods only — zero module-level
//     mutable state, P4.4 OOP Criterion ②);
//   · the finding type/lang enumerations derive from canonical sectionLabels (single source — a
//     future canonical type/lang addition cannot silently diverge);
//   · renderBody is deterministic and enforcement-free (the input contract is validated by
//     validateInput; the CLI subcommand routes stdin → validate → render);
//   · this domain module carries zero yaml dependency — the aggregate body is plain text; the
//     emit-only YAML renderer lives in the repo's scripts/emit plane, never here.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolvePackageRoot } from "../infra/resource.ts";

export interface IssueBodyTemplate {
  components: string[];
  severities: string[];
  metaFields: Array<{ key: string; label: string }>;
  sectionLabels: Record<string, Record<string, Record<string, string>>>;
  formFieldDefs: Record<string, unknown>;
  reportDef: { labels: string[] };
  masterDef: { sessionTitle: string; harnessRow: string };
}

export interface ReportFinding {
  type: string;
  lang: string;
  context: string;
  problem: string;
  impact: string;
  suggestedFix: string;
  meta: { skill: string; step: string };
}

export interface IssueReportInput {
  harness: string;
  findings: ReportFinding[];
  related?: {
    open?: Array<{ issue: number; component: string; reason: string }>;
    closed?: Array<{ issue: number }>;
    program?: { issue: number };
  };
}

// The four finding text segments — the canonical sectionLabels set keys the headings; this is the
// fixed segment order the aggregate body renders (context → problem → impact → suggestedFix).
const TEXT_FIELDS = ["context", "problem", "impact", "suggestedFix"] as const;

// <pkg>/templates/report/issue-body.json — the canonical issue-form template (the renamed home of
// the former skills/cdd-report/templates/finding-meta.json). Resolved like every engine resource
// (nearest-ancestor package.json marker walk, same convention as render/templates.ts PKG_ROOT) so
// the loader works in every file state: dev stub src tree, dist bundle, consumer install.
const ISSUE_BODY_REL = path.join("templates", "report", "issue-body.json");

/** IssueReportRenderer — the issue-body plane's single loader/validator/renderer (instance
 *  methods; the template parse is memoized on the instance, injected through no cache channel). */
export class IssueReportRenderer {
  #meta: IssueBodyTemplate | null = null;

  /** Single-point template loader — parse-on-demand, memoized on the instance. */
  loadTemplate(): IssueBodyTemplate {
    if (this.#meta === null) {
      const root = resolvePackageRoot(path.dirname(fileURLToPath(import.meta.url)));
      const file = path.join(root, ISSUE_BODY_REL);
      this.#meta = JSON.parse(readFileSync(file, "utf8")) as IssueBodyTemplate;
    }
    return this.#meta;
  }

  /** finding types — sectionLabels top-level keys (the canonical type set). */
  get types(): string[] {
    return Object.keys(this.loadTemplate().sectionLabels);
  }

  /** finding languages — the first type's language keys (canonical types are language-isomorphic). */
  get langs(): string[] {
    return Object.keys(this.loadTemplate().sectionLabels[this.types[0]] ?? {});
  }

  /** report-meta two-field bullet — canonical metaFields (key+label pairs) driven, zero hardcoding. */
  renderMeta(meta: { skill: string; step: string }): string {
    return this.loadTemplate()
      .metaFields.map(
        ({ key, label }) => `- ${label}: ${(meta as Record<string, unknown>)[key] ?? ""}`,
      )
      .join("\n");
  }

  #renderFindingBlock(finding: ReportFinding): string {
    const labels = this.loadTemplate().sectionLabels[finding.type][finding.lang];
    const segments = [
      `${labels.context}\n\n${finding.context}`,
      `${labels.problem}\n\n${finding.problem}`,
      `${labels.impact}\n\n${finding.impact}`,
      `${labels.suggestedFix}\n\n${finding.suggestedFix}`,
    ];
    return `${segments.join("\n\n")}\n${this.renderMeta(finding.meta)}`;
  }

  /** Aggregate body rendering — layout pinned: Session as one block (masterDef sessionTitle +
   *  harnessRow single line); findings grouped by type × N (sectionLabels[finding.type][lang] four
   *  segments rendered one by one, raw text between segments, the report-meta two lines directly
   *  after the four = attribution); tail ends with Dedup (all open hits) and Related (all closed
   *  hits + program attribution) as single blocks, never per-finding sections. */
  renderBody(input: IssueReportInput): string {
    const { harness, findings, related } = input;
    const { masterDef } = this.loadTemplate();
    const parts: string[] = [
      [masterDef.sessionTitle, masterDef.harnessRow.replace("<harness>", harness)].join("\n"),
      ...findings.map((finding) => this.#renderFindingBlock(finding)),
    ];
    if (related?.open?.length) {
      parts.push(
        [
          "## Dedup",
          ...related.open.map(
            ({ issue, component, reason }) =>
              `- Dedup → #${issue} (open)：${component} · ${reason}`,
          ),
        ].join("\n"),
      );
    }
    if (related?.closed?.length || related?.program) {
      const lines: string[] = [];
      if (related.closed?.length) {
        lines.push(
          ...related.closed.map(({ issue }) => `- Regression / follow-up of #${issue} (closed)`),
        );
      }
      if (related.program) {
        lines.push(`- Program: #${related.program.issue}`);
      }
      parts.push(["## Related", ...lines].join("\n"));
    }
    return parts.join("\n\n");
  }

  /** Input-shape validation (E-3 / R2 handling) — top-level 3 keys harness / findings[] /
   *  related? · per-finding 8 fields · related 3 keys, including enum validation; hand-written
   *  structural assertions (zero deps, no second schema system). Returns a violation list
   *  (`field path: reason`), empty = pass. */
  validateInput(raw: unknown): string[] {
    const errors: string[] = [];
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return ["input: expected an object with harness / findings / related?"];
    }
    const input = raw as { harness?: unknown; findings?: unknown; related?: unknown };
    if (typeof input.harness !== "string" || input.harness.length === 0) {
      errors.push("harness: non-empty string required");
    }
    const types = this.types;
    const langs = this.langs;
    if (!Array.isArray(input.findings)) {
      errors.push("findings: non-empty array required");
    } else if (input.findings.length === 0) {
      errors.push("findings: must not be empty");
    } else {
      input.findings.forEach((rawFinding, i) => {
        const finding = rawFinding as Record<string, unknown>;
        const base = `findings[${i}]`;
        if (
          typeof finding !== "object" ||
          finding === null ||
          !types.includes(String(finding.type))
        ) {
          errors.push(`${base}.type: must be one of ${types.join(" | ")}`);
        }
        if (
          typeof finding !== "object" ||
          finding === null ||
          !langs.includes(String(finding.lang))
        ) {
          errors.push(`${base}.lang: must be one of ${langs.join(" | ")}`);
        }
        for (const field of TEXT_FIELDS) {
          if (
            typeof finding !== "object" ||
            finding === null ||
            typeof finding[field] !== "string" ||
            (finding[field] as string).length === 0
          ) {
            errors.push(`${base}.${field}: non-empty string required`);
          }
        }
        const meta = (finding as { meta?: unknown })?.meta;
        if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
          errors.push(`${base}.meta: object with skill / step required`);
        } else {
          const m = meta as { skill?: unknown; step?: unknown };
          if (typeof m.skill !== "string" || m.skill.length === 0) {
            errors.push(`${base}.meta.skill: non-empty string required`);
          }
          if (typeof m.step !== "string" || m.step.length === 0) {
            errors.push(`${base}.meta.step: non-empty string required`);
          }
        }
      });
    }
    if (input.related !== undefined) {
      const r = input.related as unknown;
      if (typeof r !== "object" || r === null || Array.isArray(r)) {
        errors.push("related: object with open[] / closed[] / program? expected");
      } else {
        const rel = r as { open?: unknown; closed?: unknown; program?: unknown };
        if (rel.open !== undefined) {
          if (!Array.isArray(rel.open)) {
            errors.push("related.open: array of { issue, component, reason } expected");
          } else {
            rel.open.forEach((rawHit, i) => {
              const hit = rawHit as Record<string, unknown>;
              const base = `related.open[${i}]`;
              if (typeof hit?.issue !== "number") errors.push(`${base}.issue: number required`);
              if (typeof hit?.component !== "string" || hit.component.length === 0) {
                errors.push(`${base}.component: non-empty string required`);
              }
              if (typeof hit?.reason !== "string" || hit.reason.length === 0) {
                errors.push(`${base}.reason: non-empty string required`);
              }
            });
          }
        }
        if (rel.closed !== undefined) {
          if (!Array.isArray(rel.closed)) {
            errors.push("related.closed: array of { issue } expected");
          } else {
            rel.closed.forEach((rawHit, i) => {
              const hit = rawHit as Record<string, unknown>;
              if (typeof hit?.issue !== "number") {
                errors.push(`related.closed[${i}].issue: number required`);
              }
            });
          }
        }
        if (rel.program !== undefined) {
          const program = rel.program as Record<string, unknown> | null;
          if (!program || typeof program.issue !== "number") {
            errors.push("related.program: { issue: number } expected");
          }
        }
      }
    }
    return errors;
  }
}

/** Process-wide singleton — the CLI subcommand's default renderer (the parse.ts face holds no
 *  render state; instance-level memo makes repeated CLI runs cheap). */
export const issueBodyRenderer = new IssueReportRenderer();
