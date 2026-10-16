// packages/cdd-engine/src-next/infra/process.ts
// T12 — ProcessRunner: the new tree's process seam. Subprocess invocations are
// async instance methods over the node:child_process execFile — a fail-open run
// returns a { code, stdout, stderr } result (a missing binary or a non-zero exit
// rides the code, never a thrown exception across the seam).

import { execFile } from "node:child_process";

/** The outcome of one process run — fail-open (code signals the failure). */
export interface ProcessResult {
  /** The exit code (0 = success; a spawn failure yields a non-zero synthetic code). */
  code: number;
  /** The process's stdout, verbatim. */
  stdout: string;
  /** The process's stderr, verbatim. */
  stderr: string;
}

/** ProcessRunner — the subprocess adapter. Stateless and fail-open. */
export class ProcessRunner {
  /** Run a command with args in an optional working directory. */
  run(command: string, args: readonly string[], cwd?: string): Promise<ProcessResult> {
    return new Promise((resolve) => {
      execFile(command, [...args], { cwd }, (error, stdout, stderr) => {
        if (error === null) {
          resolve({ code: 0, stdout, stderr });
          return;
        }
        const code = typeof error.code === "number" ? error.code : 1;
        resolve({ code, stdout, stderr });
      });
    });
  }
}
