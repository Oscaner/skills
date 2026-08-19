// bin/utils/exit.mjs — CDD exit helpers（Node port of cdd_exit_ok / cdd_exit_blocked /
// cdd_exit_cli_missing）。退出码契约：0=OK；1=BLOCKED/stub；2=CLI missing。
// H1 四行输出仍由 runner.mjs（T2）独占 —— 本模块只落地退出码 + stderr 消息文本。
// exitWithCode 供 runner.mjs finish() 使用（finish 已先写 H1 + stderr，只需裸 process.exit）。
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

// 裸退出码 dispatch —— 无 stderr/H1 副作用；供 finish() 在已写 H1 + msg 后调用。
export function exitWithCode(exitCode) {
  process.exit(exitCode);
}
