// packages/cdd-engine/bin/lib/schema-utils.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From bin/lib/ → packages/cdd-engine/
const PKG_ROOT = path.resolve(__dirname, '..', '..');

const HANDOFF_SCHEMA_PATH = path.join(PKG_ROOT, 'templates', 'cdd-handoff-schema.json');

// Lazy-initialized ajv instance + compiled validator.
let _validator = null;
let _schema = null;

function getValidator() {
  if (_validator) return _validator;
  _schema = JSON.parse(readFileSync(HANDOFF_SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ allErrors: true });
  _validator = ajv.compile(_schema);
  return _validator;
}

// Returns the raw JSON Schema object (for renderHandoffStub).
export function loadHandoffSchema() {
  getValidator(); // ensure _schema is loaded
  return _schema;
}

// Validates a handoff object against cdd-handoff-schema.json.
// Returns {valid: true} or {valid: false, reason: string}.
export function validateHandoffSchema(obj) {
  const validate = getValidator();
  const valid = validate(obj);
  if (valid) return { valid: true };
  const reason = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join('; ') ?? 'unknown';
  return { valid: false, reason };
}
