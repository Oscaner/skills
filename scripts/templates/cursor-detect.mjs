#!/usr/bin/env node
// scripts/emit.mjs — do not edit
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PENDING_ROOT = join(
  process.env.TMPDIR ?? tmpdir(),
  "oscaner-osuperpowers-router",
  "pending",
);

const TARGETS = {{TARGETS_JSON}};

// Slash-intercept targets: bare `^/<slug>$` / inline ` /<slug>` map to an
// override name (mirrors Claude UserPromptExpansion — same SOT upstream_slug).
const SLASH_TARGETS = {{SLASH_TARGETS_JSON}};

function compilePattern(pat) {
  // Python `(?i)` inline flag → JS `i` RegExp flag (strip the prefix).
  const flags = pat.startsWith("(?i)") ? "i" : "";
  return new RegExp(pat.replace(/^\(\?i\)/, ""), flags);
}

function slashPattern(slug) {
  const s = slug.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp(`(?:^|\\s)/(?:superpowers:)?${s}(?:\\s|$)`, "i");
}

function sessionKey(data) {
  if (data.conversation_id) return data.conversation_id;
  if (data.session_id) return data.session_id;
  return createHash("sha256")
    .update(data.prompt ?? "")
    .digest("hex")
    .slice(0, 16);
}

function failOpen() {
  process.stdout.write(JSON.stringify({ continue: true }));
}

let data;
try {
  data = JSON.parse(readFileSync(0, "utf8"));
} catch {
  failOpen();
  process.exit(0);
}

const key = sessionKey(data);
const attachments = data.attachments ?? [];

outer: for (const t of TARGETS) {
  for (const att of attachments) {
    const path = att.file_path ?? att.path ?? "";
    if (!path) continue;
    for (const pat of t.attach_res) {
      if (compilePattern(pat).test(path)) {
        mkdirSync(PENDING_ROOT, { recursive: true });
        writeFileSync(
          join(PENDING_ROOT, `${key}.json`),
          JSON.stringify({
            override: t.name,
            skill_suffix: t.skill_suffix,
            trigger: "attach",
            detected_at: Math.floor(Date.now() / 1000),
          }),
        );
        break outer;
      }
    }
  }
}

// Slash intercept: bare `^/<slug>$` or inline ` /<slug>` (optionally
// `/superpowers:<slug>`). Writes the same pending marker with trigger="slash".
const promptText = data.prompt ?? "";
for (const s of SLASH_TARGETS) {
  if (slashPattern(s.slug).test(promptText)) {
    mkdirSync(PENDING_ROOT, { recursive: true });
    writeFileSync(
      join(PENDING_ROOT, `${key}.json`),
      JSON.stringify({
        override: s.name,
        skill_suffix: s.suffix,
        trigger: "slash",
        detected_at: Math.floor(Date.now() / 1000),
      }),
    );
    break;
  }
}

process.stdout.write(JSON.stringify({ continue: true }));
