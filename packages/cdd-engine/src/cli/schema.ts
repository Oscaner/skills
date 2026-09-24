// packages/cdd-engine/src/cli/schema.ts — `cdd schema get <type>` action body (P4.3 Task 5):
// discovery-only canonical schema output, zero enforcement logic (no audit, no dispatch, no
// convergence gate). The type enum is the engine's DOC_SCHEMA_NAMES registry — no second list; the
// accepted names and the loaded files are the same single source loadDocSchema uses. stdout gets
// the canonical schema JSON verbatim (byte-identical to the shipped file — raw-text load, never a
// re-serialization), and every exit routes through the exit.ts exit family — no bare return. The
// parse.ts declaration is the overall command face; this module owns only the type gate + the
// stdout/exit surface (same split base-branch.ts documents for its artifact commands).
import { cliUsageError, exitOk } from "../infra/exit.ts";
import { DOC_SCHEMA_NAMES, loadDocSchemaText, type DocSchemaName } from "../documents/schema.ts";

/** `cdd schema get <type>`: gate the type against the DOC_SCHEMA_NAMES registry (unknown → usage
 *  exit 2 via the cliUsageError family — the bin wrapper prints the schema usage line + the message
 *  below with the same-source enumeration); known → print the canonical schema bytes to stdout and
 *  exit 0 via the exit.ts family (the throw unwinds the run boundary, no bare return afterwards). */
export function runSchemaGet(type: string): never {
  if (!(DOC_SCHEMA_NAMES as readonly string[]).includes(type)) {
    throw cliUsageError(`unknown schema type: ${type} (available: ${DOC_SCHEMA_NAMES.join(", ")})`);
  }
  process.stdout.write(loadDocSchemaText(type as DocSchemaName));
  exitOk();
}
