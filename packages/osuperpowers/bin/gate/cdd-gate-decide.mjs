#!/usr/bin/env node
// gate/cdd-gate-decide.mjs — 薄 CDD gate decide CLI（P4b T2）。
// stdin JSON → gateDecide → stdout JSON。exit 0 恒返回；deny 表达在 JSON，
// 由调用方翻译（bash engine P5 过渡 + 外部/测试）。
import { gateDecide } from "./cdd-gate-core.mjs";
import { readStdin } from "./adapters/lib.mjs";

const input = JSON.parse(await readStdin());
process.stdout.write(JSON.stringify(gateDecide(input)));
