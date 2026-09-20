// packages/cdd-engine/src/infra/exit.ts — CDD exit helpers (TS port of exit.mjs; spec §2.13 exit row)
// + the P6 T24 error-consolidation family (spec T7.3 ⑤). Two semantic layers, both exported from
// here per the「全部手动 throw 归 exit.ts」rule:
//
//   Exit path (CLI contract — 0=OK / 1=BLOCKED / 2=CLI missing or usage / 3=review convergence):
//     exit helpers throw ExitRequested (NEVER direct process.exit): the throw unwinds run-boundary
//     try/finally (teardownAll / reap) first; bin.ts's catch maps the code to process.exit.
//
//   CddExitError family — recoverable orchestration errors (user-comprehensible, re-dispatchable):
//     exitCode + kind fields; the pre-existing exit helpers keep their exact behavior, and the
//     engine gate errors (DispatchBlocked / CddBlockedError / RunBlocked) subclass this family so
//     bin.ts's top-level catch unifies by kind. exit table 0/1/2/3 unchanged.
//
//   invariant(cond, msg) — library invariant assertions (developer errors, not recoverable, no
//     process exit): throws a plain Error with the exact message (throw semantics preserved, never
//     silenced — spec: 库内不变量断言走 invariant 工厂，保持 throw 语义不哑化、不转进程退出).
export class ExitRequested extends Error {
  code: number;
  constructor(code: number, message = `cdd exit ${code}`) {
    super(message);
    this.name = "ExitRequested";
    this.code = code;
  }
}

/** Recoverable orchestration error — the unified family root (spec T7.3 ⑤): users of the family
 * branch on exitCode (bin-to-process-exit mapping) + kind (blocked / cli-missing / usage /
 * run-blocked / …). Subclasses keep their own names (DispatchBlocked / CddBlockedError) so
 * existing instanceof checks keep working. */
export class CddExitError extends Error {
  readonly exitCode: number;
  readonly kind: string;
  constructor(message: string, options: { exitCode?: number; kind?: string } = {}) {
    super(message);
    this.name = "CddExitError";
    this.exitCode = options.exitCode ?? 1;
    this.kind = options.kind ?? "blocked";
  }
}

/** Library invariant assertion single factory (spec T7.3 ⑤): `unknown family/format` guards in the
 * render/artifacts/infra library (templates.ts / brief.ts / naming.ts / finalize.ts / …). Throws a
 * plain Error with the exact message — the message IS the contract (tests pin e.g. "unknown review
 * type: task"); it is a developer/engine invariant, never a process exit. */
export function invariant(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** CLI usage error (CLI contract): exit code 2 + kind "usage". The name/code pair (CLIError /
 * E_UNKNOWN_OPTION) keeps the citty-parse-error parity that the bin wrapper keys on (usage line +
 * message + exit 2) — shared.ts guardArgs / intTask emit through here. */
export function cliUsageError(msg: string, code = "E_UNKNOWN_OPTION"): CddExitError {
  const err = new CddExitError(msg, { exitCode: 2, kind: "usage" });
  err.name = "CLIError";
  (err as CddExitError & { code: string }).code = code;
  return err;
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