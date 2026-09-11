// packages/cdd-engine/lib/exit.mjs — CDD exit helpers（Node port of cdd_exit_ok / cdd_exit_blocked /
// cdd_exit_cli_missing）。退出码契约：0=OK；1=BLOCKED/stub；2=CLI missing；3=Review Stopping（caller 侧）。
// H1 四行输出仍由 runner.mjs（T2）独占 —— 本模块只落地退出码 + stderr 消息文本。
import process from "node:process";

// ExitRequested sentinel —— 退出路径改为 THROW 而非直调 process.exit。
// 动机（Task 3 review warn，实测验证）：`node -e 'try{process.exit(3)}finally{console.log(1)}'`
// 不打印 1 —— process.exit 终结进程且不展开 try/finally。run* 在生命周期 wiring 后的 try/finally
// （startIdleMonitor/teardownAll）若被 process.exit 短路，run 边界回收即死代码。THROW 让调用链
// 先展开 finally（teardownAll 连根回收）再向上传播，由 bin/cdd.mjs 边界 catch 拦截 → process.exit(code)。
export class ExitRequested extends Error {
  constructor(code, message = `cdd exit ${code}`) {
    super(message);
    this.code = code;
  }
}

function throwExit(code) {
  throw new ExitRequested(code);
}

export function exitOk() {
  throwExit(0);
}

// exit 1 + CDD_BLOCKED stderr（可选消息）—— 对齐 cdd_exit_blocked。
export function exitBlocked(msg) {
  if (msg) process.stderr.write(`CDD_BLOCKED: ${msg}\n`);
  throwExit(1);
}

// exit 2 + CDD_CLI_MISSING stderr（可选消息）—— 对齐 cdd_exit_cli_missing。
export function exitCliMissing(msg) {
  if (msg) process.stderr.write(`CDD_CLI_MISSING: ${msg}\n`);
  throwExit(2);
}

// 裸退出码 dispatch —— 无 stderr/H1 副作用；供 finish() 在已写 H1 + msg 后调用。
export function exitWithCode(exitCode) {
  throwExit(exitCode);
}
