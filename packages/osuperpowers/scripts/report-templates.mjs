// report-templates.mjs — report-issues rendering single point.
//
// Bare-call single entry (Task 14, §2.5): `node "${pluginRoot}/scripts/report-
// templates.mjs" < stdin JSON` renders the aggregate body straight to stdout.
// The CLI takes no mode flag and no per-finding comment mode — one mode, the
// single self-contained report issue body. Finding body paragraphs are built from the
// canonical finding-meta.json sectionLabels (four segments), each finding's
// report-meta (`- Skill: <skill>` / `- Step: <step>`, metaFields 2-field
// canonical) is placed directly after its four segments (location adjacency =
// attribution; unambiguous across skills when N > 1), and the Dedup/Related
// tail sections aggregate all open / closed / program hits. The CLI validates
// the stdin contract (findings non-empty · type/lang enums · per-finding
// fields · meta.skill/step · related structure) before rendering — violations
// exit 1 with the offending field path (E-3 / R2 early report). The consumer
// runtime imports zero third-party packages: `yaml` lives only in the
// emit-only `render-yaml.mjs` module (repo root devDependencies, §2.13 (b)).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const findingMeta = JSON.parse(
  readFileSync(
    new URL("../skills/report-issues/templates/finding-meta.json", import.meta.url),
    "utf8",
  ),
);
const { sectionLabels, masterDef } = findingMeta;

// Enumeration single-source: derived from canonical sectionLabels (eliminates a duplicated
// expression surface vs canonical) — FINDING_TYPES = sectionLabels top-level keys (type),
// LANGS = the first type's language keys (current canonical types are language-isomorphic
// en/zh). Validation and rendering share the one enumeration source; a future canonical
// type/lang addition cannot silently diverge.
const FINDING_TYPES = Object.keys(sectionLabels);
const LANGS = Object.keys(sectionLabels[FINDING_TYPES[0]] ?? {});
const TEXT_FIELDS = ["context", "problem", "impact", "suggestedFix"];

/** report-meta two-field bullet — driven by canonical metaFields (key+label pairs), zero hardcoding. */
export function renderMeta(meta) {
  return findingMeta.metaFields
    .map(({ key, label }) => `- ${label}: ${meta[key] ?? ""}`)
    .join("\n");
}

// --- aggregate body rendering --------------------------------------------------
// Layout (§2.5 pinned): Session as one block (masterDef sessionTitle + harnessRow single
// line); findings grouped by type × N (sectionLabels[finding.type][lang] four segments
// rendered one by one, with raw text between segments; the two meta lines directly after
// the four segments = attribution). Tail ends with Dedup (all open hits) and Related (all
// closed hits + program attribution) as single blocks, not per-finding sections.
function renderFindingBlock(finding) {
  const labels = sectionLabels[finding.type][finding.lang];
  const segments = [
    `${labels.context}\n\n${finding.context}`,
    `${labels.problem}\n\n${finding.problem}`,
    `${labels.impact}\n\n${finding.impact}`,
    `${labels.suggestedFix}\n\n${finding.suggestedFix}`,
  ];
  return segments.join("\n\n") + `\n${renderMeta(finding.meta)}`;
}

export function renderBody({ harness, findings, related }) {
  const parts = [
    [masterDef.sessionTitle, masterDef.harnessRow.replace("<harness>", harness)].join("\n"),
    ...findings.map(renderFindingBlock),
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
    const lines = [];
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

// --- input shape validation (E-3 / R2 handling) ------------------------------
// Top-level 3 keys harness / findings[] / related? · per-finding 8 fields · related 3 keys,
// including enum validation; hand-written structural assertions (~40 lines, zero deps),
// no second schema system. Returns a violation list (`field path: reason`), empty = pass.
export function validateInput(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return ["input: expected an object with harness / findings / related?"];
  }
  if (typeof input.harness !== "string" || input.harness.length === 0) {
    errors.push("harness: non-empty string required");
  }
  if (!Array.isArray(input.findings)) {
    errors.push("findings: non-empty array required");
  } else if (input.findings.length === 0) {
    errors.push("findings: must not be empty");
  } else {
    input.findings.forEach((finding, i) => {
      const base = `findings[${i}]`;
      if (!FINDING_TYPES.includes(finding?.type)) {
        errors.push(`${base}.type: must be one of ${FINDING_TYPES.join(" | ")}`);
      }
      if (!LANGS.includes(finding?.lang)) {
        errors.push(`${base}.lang: must be one of ${LANGS.join(" | ")}`);
      }
      for (const field of TEXT_FIELDS) {
        if (typeof finding?.[field] !== "string" || finding[field].length === 0) {
          errors.push(`${base}.${field}: non-empty string required`);
        }
      }
      if (!finding?.meta || typeof finding.meta !== "object" || Array.isArray(finding.meta)) {
        errors.push(`${base}.meta: object with skill / step required`);
      } else {
        if (typeof finding.meta.skill !== "string" || finding.meta.skill.length === 0) {
          errors.push(`${base}.meta.skill: non-empty string required`);
        }
        if (typeof finding.meta.step !== "string" || finding.meta.step.length === 0) {
          errors.push(`${base}.meta.step: non-empty string required`);
        }
      }
    });
  }
  if (input.related !== undefined) {
    const r = input.related;
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      errors.push("related: object with open[] / closed[] / program? expected");
    } else {
      if (r.open !== undefined) {
        if (!Array.isArray(r.open)) {
          errors.push("related.open: array of { issue, component, reason } expected");
        } else {
          r.open.forEach((hit, i) => {
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
      if (r.closed !== undefined) {
        if (!Array.isArray(r.closed)) {
          errors.push("related.closed: array of { issue } expected");
        } else {
          r.closed.forEach((hit, i) => {
            if (typeof hit?.issue !== "number") {
              errors.push(`related.closed[${i}].issue: number required`);
            }
          });
        }
      }
      if (r.program !== undefined) {
        if (!r.program || typeof r.program.issue !== "number") {
          errors.push("related.program: { issue: number } expected");
        }
      }
    }
  }
  return errors;
}

// --- CLI（bare-call single entry）-------------------------------------------------------
const isCli =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCli) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch (err) {
    process.stderr.write(`input: invalid JSON — ${err.message}\n`);
    process.exit(1);
  }
  const violations = validateInput(input);
  if (violations.length > 0) {
    process.stderr.write(
      `Invalid report-issues input:\n${violations.map((v) => `  ${v}`).join("\n")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(renderBody(input) + "\n");
}
