// packages/cdd-engine/src/infra/exit.ts — CDD exit helpers (TS port of exit.mjs; spec §2.13 exit row).
// Exit-code contract: 0=OK; 1=BLOCKED; 2=CLI missing. H1 four-line output stays the runner's
// concern — this module only lands exit codes + stderr message text.
// Exit path throws ExitRequested (NEVER direct process.exit): the throw unwinds run-boundary
// try/finally (teardownAll / reap) first; bin.ts's catch maps the code to process.exit.
export class ExitRequested extends Error {
  code: number;
  constructor(code: number, message = `cdd exit ${code}`) {
    super(message);
    this.name = "ExitRequested";
    this.code = code;
  }
}

function throwExit(code: number): never {
  throw new ExitRequested(code);
}

export function exitOk(): never {
  throwExit(0);
}

export function exitBlocked(msg?: string): never {
  if (msg) process.stderr.write(`CDD_BLOCKED: ${msg}\n`);
  throwExit(1);
}

export function exitCliMissing(msg?: string): never {
  if (msg) process.stderr.write(`CDD_CLI_MISSING: ${msg}\n`);
  throwExit(2);
}

export function exitWithCode(exitCode: number): never {
  throwExit(exitCode);
}