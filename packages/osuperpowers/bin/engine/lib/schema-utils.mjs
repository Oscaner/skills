// engine/lib/schema-utils.mjs — shared handoff schema validation.
// loadHandoffSchema: load JSON Schema from skills/_templates/handoff-schema.json.
// validateHandoffSchema: validate handoff object against schema (required fields, types, enums).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..');

export function loadHandoffSchema(schemaPath) {
  const p = schemaPath ?? path.join(PKG_ROOT, 'skills', '_templates', 'handoff-schema.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function validateHandoffSchema(handoff, schemaPath) {
  const schema = loadHandoffSchema(schemaPath);
  // Check required fields
  for (const field of schema.required) {
    if (!(field in handoff)) return { valid: false, reason: `missing required field: ${field}` };
  }
  // Reject unknown top-level properties (additionalProperties: false)
  const knownProps = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(handoff)) {
    if (!knownProps.has(key)) return { valid: false, reason: `unknown property: ${key}` };
  }
  // Type checks
  if (handoff.task !== undefined && typeof handoff.task !== 'number')
    return { valid: false, reason: `task must be integer` };
  if (handoff.phase && !schema.properties.phase.enum.includes(handoff.phase))
    return { valid: false, reason: `invalid phase: ${handoff.phase}` };
  if (handoff.status && !schema.properties.status.enum.includes(handoff.status))
    return { valid: false, reason: `invalid status: ${handoff.status}` };
  if (handoff.commits && handoff.commits.base && !/^[0-9a-f]{40}$/.test(handoff.commits.base))
    return { valid: false, reason: `commits.base must be 40-char hex SHA` };
  if (handoff.findings !== undefined && !Array.isArray(handoff.findings))
    return { valid: false, reason: `findings must be array` };
  if (handoff.artifacts !== undefined && typeof handoff.artifacts !== 'object')
    return { valid: false, reason: `artifacts must be object` };
  return { valid: true };
}
