// bin/utils/skills-probe.config.mjs — skills-probe 的 per-harness 探测配置。
// 探测路径 SOT：docs/research/2026-08-16-harness-plugin-availability.md（探测顺序 CLI/list → glob；
// env 层为 hook-context-only 扩展，P6a 不实现）。installHint 生成安装指引（claude 的 marketplace-add
// 前置见 research §2.1）。
//
// harnesses 集合 = 12（8 安装即用 + 4 os-init），MUST 与 P6b §2.5 逐一一致：
//   install-and-use（缺失 → probe exit 3）：claude/cursor-agent/droid/grok/qoder/codex/gemini/pi
//   os-init（缺失 → 提示 `os-init harness <name>`，非故障）：opencode/trae/vibe/kiro
export const config = {
  requiredPlugins: ["superpowers", "mattpocock-skills", "osuperpowers", "osuperpowers-router"],
  // 最终通道分类（P6b §2.5 权威）：install-and-use → probe exit 3；os-init → 提示
  channel: {
    "install-and-use": ["claude", "cursor-agent", "droid", "grok", "qoder", "codex", "gemini", "pi"],
    "os-init": ["opencode", "trae", "vibe", "kiro"],
  },
  harnesses: {
    claude: {
      cli: "claude",
      probe: "plugin-list",
      cacheGlob: "~/.claude/plugins/cache/oscaner/<plugin>/*/skills/",
      installHint: (p) => `/plugin marketplace add Oscaner/skills && /plugin install ${p}@oscaner`,
    },
    "cursor-agent": {
      cli: "cursor-agent",
      probe: "skill-dir",
      dirs: [".agents/skills", ".cursor/skills"],
      installHint: () => "copy skills 到 .agents/skills/ 或装 marketplace",
    },
    droid: {
      cli: "droid",
      probe: "skill-dir",
      dirs: [".agents/skills"],
      installHint: () => "copy skills 到 .agents/skills/",
    },
    grok: {
      cli: "grok",
      probe: "plugin-list",
      installHint: () => "装 oscaner marketplace（grok 读 Claude marketplace）",
    },
    qoder: {
      cli: "qoder",
      probe: "skill-dir",
      dirs: [".agents/skills", ".qoder/skills"],
      installHint: () => "装 .qoder-plugin 或 copy skills",
    },
    codex: {
      cli: "codex",
      probe: "skill-dir",
      dirs: [".agents/skills"],
      installHint: () => "装 .codex-plugin 或 copy skills",
    },
    gemini: {
      cli: "gemini",
      probe: "skill-dir",
      dirs: [".agents/skills", ".gemini/skills"],
      installHint: () => "gemini extensions install 或 copy skills",
    },
    pi: {
      cli: "pi",
      probe: "package-list",
      installHint: (p) => `pi install npm:@oscaner-skills/${p}`,
    },
    opencode: {
      cli: "opencode",
      probe: "skill-dir",
      dirs: [".opencode/skills", ".agents/skills"],
      installHint: () => "os-init harness opencode（copy skills）",
    },
    trae: {
      cli: "trae",
      probe: "skill-dir",
      dirs: [".agents/skills", ".trae/skills"],
      installHint: () => "os-init harness trae",
    },
    vibe: {
      cli: "vibe",
      probe: "skill-dir",
      dirs: [".agents/skills", ".vibe/skills"],
      installHint: () => "os-init harness vibe",
    },
    kiro: {
      cli: "kiro",
      probe: "skill-dir",
      dirs: [".agents/skills", ".kiro/skills"],
      installHint: () => "os-init harness kiro",
    },
  },
};
