// bin/pi-router.ts — Pi TS extension trigger router（P6b T2）。
// scripts/emit.mjs — do not edit

const MAP: Record<string, string> = {
  "brainstorming": "osuperpowers:os-brainstorming",
  "writing-plans": "osuperpowers:os-writing-plans",
  "subagent-driven-development": "osuperpowers:cli-driven-development",
  "executing-plans": "osuperpowers:os-executing-plans",
  "finishing-a-development-branch": "osuperpowers:os-finishing",
  "systematic-debugging": "osuperpowers:os-debugging",
  "test-driven-development": "mattpocock-skills:tdd",
  "verification-before-completion": "osuperpowers:os-verification",
  "receiving-code-review": "osuperpowers:os-code-review",
  "using-git-worktrees": "osuperpowers:os-finishing"
};

export function on(pi: any): void {
  pi.on("input", async (event: { text: string }, _ctx: any) => {
    const text = event.text ?? "";
    const m = text.match(/^\/([a-z][a-z0-9-]*)/);
    if (!m) return null;
    const slug = m[1];
    const target = MAP[slug];
    if (!target) return null;
    return { action: "transform", text: `Skill(${target}) ${text}` };
  });
}
