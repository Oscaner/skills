// bin/utils/skills-probe.config.mjs — skills-probe 的 per-harness 探测配置。
// 探测路径 SOT：docs/research/2026-08-16-harness-plugin-availability.md（探测顺序 CLI/list → glob；
// env 层为 hook-context-only 扩展，P6a 不实现）。installHint 生成安装指引（claude 的 marketplace-add
// 前置见 research §2.1）。
export const config = {
  requiredPlugins: ["superpowers", "mattpocock-skills", "engineering", "superpowers-overrides"],
  harnesses: {
    claude: {
      probe: "plugin-list",
      cacheGlob: "~/.claude/plugins/cache/oscaner/<plugin>/*/skills/",
      installHint: (p) => `/plugin marketplace add Oscaner/skills && /plugin install ${p}@oscaner`,
    },
    "cursor-agent": {
      probe: "skill-dir",
      dirs: [".agents/skills", ".cursor/skills"],
      installHint: () => "copy skills 到 .agents/skills/ 或装 marketplace",
    },
    droid: {
      probe: "skill-dir",
      dirs: [".agents/skills"],
      installHint: () => "copy skills 到 .agents/skills/",
    },
    pi: {
      probe: "package-list",
      dirs: [".pi/skills", ".agents/skills"], // dir-copy fallback（piDirCopyPlugins 无 pi key）
      installHint: (p) => `pi install npm:@oscaner-skills/${p}`,
    },
    opencode: {
      probe: "skill-dir",
      dirs: [".opencode/skills", ".agents/skills"],
      installHint: () => "copy skills 到 .opencode/skills/（npm 包技能不自动发现）",
    },
  },
  // pi 的 engineering/overrides 例外：无 pi key，需目录复制到 .pi/skills/ 或 .agents/skills/。
  piDirCopyPlugins: ["engineering", "superpowers-overrides"],
};
