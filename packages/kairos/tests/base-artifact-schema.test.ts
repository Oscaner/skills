// packages/kairos/tests/base-artifact-schema.test.ts
// T12 (spec §3.2 ⑪ · gate domicile §3.6: engine⇄consumer cross-face → kairos suite)
// — the `base.md` artifact-schema gate. The `cdd-dev/docs/base.md` Section 2 table
// declares the base artifact schema (the field set + the 4-value `source` enum);
// this gate pins that declaration to the engine's runtime single source
// (`BASE_ARTIFACT_FIELDS` + the `--source` channel domain), so the shipped doc and
// the engine artifact can never drift silently.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { BASE_ARTIFACT_FIELDS } from "../../cdd-engine/src-next/face/artifacts.ts";
import { ARGV_CHANNEL } from "../../cdd-engine/src-next/face/declare.ts";

const BASE_MD = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../skills/cdd-dev/docs/base.md",
);

/** The `base.md` schema-table field names + the declared source enum literals. */
const parseBaseMd = (): { fields: string[]; sources: string[] } => {
  const text = readFileSync(BASE_MD, "utf8");
  // The Section 2 schema table only: from the "| Field | Type | Description |" header
  // to the first blank line (later sections carry their own tables).
  const tableStart = text.indexOf("| Field | Type | Description |");
  const tableEnd = text.indexOf("\n\n", tableStart);
  const body = text.slice(tableStart, tableEnd === -1 ? undefined : tableEnd);
  const rowRe = /^\|\s*`([^`]+)`\s*\|/gm;
  const fields: string[] = [];
  for (const m of body.matchAll(rowRe)) fields.push(m[1]!);
  // The source enum literals — the `enum (4 values)` row's value list.
  const sourceRow = body.match(/\|\s*`source`\s*\|\s*enum[^|]*\|([^|]*)\|/);
  const sources = (sourceRow?.[1]?.match(/`([^`]+)`/g) ?? []).map((s) => s.replace(/`/g, ""));
  return { fields, sources };
};

test("the base.md schema table mirrors the BaseArtifact field set (spec §3.2 ⑪)", () => {
  const { fields } = parseBaseMd();
  expect(fields).toEqual([...BASE_ARTIFACT_FIELDS]);
});

test("the base.md source enum mirrors the engine's --source channel domain", () => {
  const { sources } = parseBaseMd();
  expect(sources).toEqual([...(ARGV_CHANNEL.source.values ?? [])]);
  // the documented "4 values" count is verified against the single source
  expect(sources).toHaveLength(4);
});
