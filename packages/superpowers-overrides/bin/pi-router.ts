// bin/pi-router.ts — Pi TS extension trigger router（P6b T2）。
// scripts/emit.mjs — do not edit

const MAP: Record<string, string> = {
  "brainstorming": "engineering:os-brainstorming",
  "writing-plans": "engineering:os-writing-plans",
  "subagent-driven-development": "engineering:cli-driven-development",
  "executing-plans": "engineering:os-executing-plans",
  "finishing-a-development-branch": "engineering:os-finishing",
  "systematic-debugging": "engineering:os-debugging",
  "test-driven-development": "mattpocock-skills:tdd",
  "verification-before-completion": "engineering:os-verification",
  "receiving-code-review": "engineering:os-code-review",
  "using-git-worktrees": "engineering:os-finishing"
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
