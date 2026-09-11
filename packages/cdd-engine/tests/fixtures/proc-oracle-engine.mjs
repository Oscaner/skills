// tests/fixtures/proc-oracle-engine.mjs — 独立「引擎」：模拟被 SIGKILL 前已落盘 registry 的外部引擎进程
import { initProcLifecycle, spawnManaged, persistRegistry } from "../../lib/lifecycle/proc.mjs";
const disk = process.argv[2];
await initProcLifecycle({ diskPath: disk });
await spawnManaged(process.execPath, ["-e", "const{spawn}=require('node:child_process');spawn(process.execPath,['-e','setTimeout(()=>{},60000)','P1ORPHAN']).unref();process.exit(0)"], { timeoutMs: 5000 });
await persistRegistry();
setInterval(() => {}, 60_000);   // 引擎驻留——测试以 SIGKILL 模拟被杀（无 teardown 路径可走）
