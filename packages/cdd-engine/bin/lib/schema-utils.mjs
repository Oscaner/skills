// packages/cdd-engine/bin/lib/schema-utils.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From bin/lib/ → packages/cdd-engine/
const PKG_ROOT = path.resolve(__dirname, '..', '..');

// Two handoff schemas ship in templates/schema/:
//   cdd  — task handoffs (implement/task-review/fix; task/phase enums, commits objects)
//   docs — doc review handoffs (spec-review/plan-review/branch-review/spec-fix/plan-fix;
//          required doc_path, no task/commits)
const SCHEMA_PATHS = {
  cdd:  path.join(PKG_ROOT, 'templates', 'schema', 'cdd-handoff-schema.json'),
  docs: path.join(PKG_ROOT, 'templates', 'schema', 'docs-handoff-schema.json'),
};

// Per-schema lazy caches: { validator, schema }.
const CACHE = new Map();

function getEntry(schemaName = 'cdd') {
  if (CACHE.has(schemaName)) return CACHE.get(schemaName);
  const schemaPath = SCHEMA_PATHS[schemaName];
  if (!schemaPath) throw new Error(`unknown handoff schema: ${schemaName}`);
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true });
  const entry = { schema, validator: ajv.compile(schema) };
  CACHE.set(schemaName, entry);
  return entry;
}

// Returns the raw JSON Schema object (for renderHandoffStub).
export function loadHandoffSchema(schemaName = 'cdd') {
  return getEntry(schemaName).schema;
}

// Validates a handoff object against the named schema ('cdd' | 'docs').
// Returns {valid: true} or {valid: false, reason: string}.
export function validateHandoffSchema(obj, schemaName = 'cdd') {
  const { validator } = getEntry(schemaName);
  const valid = validator(obj);
  if (valid) return { valid: true };
  const reason = validator.errors?.map(e => `${e.instancePath} ${e.message}`).join('; ') ?? 'unknown';
  return { valid: false, reason };
}