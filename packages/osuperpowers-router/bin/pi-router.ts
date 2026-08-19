// bin/pi-router.ts — Pi TS extension trigger router（P6b T2）。
// scripts/emit.mjs — do not edit

const MAP: Record<string, string> = {
  "brainstorming": "osuperpowers:brainstorming",
  "writing-plans": "osuperpowers:writing-plans",
  "subagent-driven-development": "osuperpowers:cli-driven-development",
  "executing-plans": "osuperpowers:executing-plans",
  "finishing-a-development-branch": "osuperpowers:finishing",
  "systematic-debugging": "osuperpowers:debugging",
  "test-driven-development": "mattpocock-skills:tdd",
  "verification-before-completion": "osuperpowers:verification",
  "receiving-code-review": "osuperpowers:code-review",
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
