// bin/pi-router.ts — Pi TS extension trigger router（P6b T2）。
// scripts/emit.mjs — do not edit

const MAP: Record<string, string> = {
  "brainstorming": "osuperpowers:brainstorming",
  "writing-plans": "osuperpowers:writing-plans",
  "subagent-driven-development": "osuperpowers:cli-driven-development",
  "finishing-a-development-branch": "osuperpowers:finishing",
  "test-driven-development": "mattpocock-skills:tdd",
  "using-git-worktrees": "osuperpowers:finishing"
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
