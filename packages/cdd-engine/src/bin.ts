// src/bin.ts — P5 Task 1 占位 CLI 入口（薄转发，零命令定义）
// 全量 TS 后 bin/cdd.mjs 将失效；Task 9 citty 化落地真实命令面（defineMainCommand 装配 → cli/ 派发，
// spec §2.13 目录树），本文件届时整体替换。本 Task 仅保证入口可达：
//   build / dev:stub 之下 dist/cli.mjs 转发到现有 bin/cdd.mjs commander 命令面，
//   argv 与 stdio 原样透传，退出码逐位转发。不引入任何业务逻辑。
//
// 与 bin/cdd.mjs 的 isMain 守卫不同，这里**无条件**执行：unbuild 的 stub 产物（dist/cli.mjs）经 jiti
// 即时加载本文件，argv[1] 指向 dist/ 而 import.meta.url 指 src/，import.meta.url 判主恒为 false；
// 而本产物只作为 CLI 入口被 node 直接执行（package.json 的 bin/main/exports 均指向它，无库消费者
// import 面），无条件 boot 是唯一可靠的方式。
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// bin/cdd.mjs 与 src/ 同处包根下：无论本模块解析为 src/bin.ts 还是 dist/cli.mjs（stub），
// 相对 import.meta.url 的 "../bin/cdd.mjs" 恒指向同一文件（P4 环境面收口：零 cwd 读取、零环境变量覆写缝）。
const binPath = fileURLToPath(new URL("../bin/cdd.mjs", import.meta.url));

const child = spawn(process.execPath, [binPath, ...process.argv.slice(2)], {
  stdio: "inherit", // --help 输出、交互输入、进度回显全部直通终端
});

child.on("error", (err) => {
  // 兜底报错（如打包产物缺引擎源码）：明确失败而非静默退出
  process.stderr.write(`cdd: 无法启动引擎入口 ${binPath}: ${err.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal !== null || code === null) {
    // 子进程被信号杀死（非常路径；正常路径 bin/cdd.mjs 把信号转换成退出码）→ 对自身复抛同一信号，
    // 保持 shell 的 128+signo 退出语义。
    process.kill(process.pid, signal ?? "SIGTERM");
    return;
  }
  process.exit(code);
});