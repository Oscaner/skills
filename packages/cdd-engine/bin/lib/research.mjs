// engine/lib/research.mjs — Research module: methodology constant + prompt builder + findings writer.
import { writeFileSync } from "node:fs";

export const RESEARCH_METHODOLOGY = `## Research Methodology

Follow this 5-step research framework:

### 1. Scope
Define the research question precisely. Identify what needs to be discovered and why.

### 2. Investigate
Gather information from available sources: code, docs, tests, configs, external references.
Follow leads systematically — don't stop at the first answer.

### 3. Synthesize
Organize findings into coherent themes. Identify patterns, relationships, and contradictions.

### 4. Verify
Cross-reference findings against multiple sources. Challenge assumptions.
Identify confidence levels for each conclusion.

### 5. Write
Produce clear, actionable findings with evidence and confidence levels.
Distinguish facts from inferences. Note open questions.`;

// Build a complete research prompt from brief content + methodology.
export function buildResearchPrompt(briefContent) {
  return `${RESEARCH_METHODOLOGY}

---

## Research Brief

${briefContent}`;
}

// Write findings to a Markdown file.
export function writeFindings(outputPath, content) {
  writeFileSync(outputPath, content, "utf8");
}
