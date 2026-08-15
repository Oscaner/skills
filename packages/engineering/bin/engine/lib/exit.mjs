// engine/lib/exit.mjs — CDD exit helpers（Node port of cdd_exit_ok / cdd_exit_blocked /
// cdd_exit_cli_missing）。退出码契约：0=OK；1=BLOCKED/stub；2=CLI missing。
// H1 四行输出仍由 runner.mjs（T2）独占 —— 本模块只落地退出码 + stderr 消息文本。
import process from "node:process";

export function exitOk() {
  process.exit(0);
}

// exit 1 + CDD_BLOCKED stderr（可选消息）—— 对齐 cdd_exit_blocked。
export function exitBlocked(msg) {
  if (msg) process.stderr.write(`CDD_BLOCKED: ${msg}\n`);
  process.exit(1);
}

// exit 2 + CDD_CLI_MISSING stderr（可选消息）—— 对齐 cdd_exit_cli_missing。
export function exitCliMissing(msg) {
  if (msg) process.stderr.write(`CDD_CLI_MISSING: ${msg}\n`);
  process.exit(2);
}
