---
"superpowers-overrides": minor
---

Add `spor-report-issue` standalone skill. After finishing a development session, `/spor-report-issue` analyses the conversation context, SDD ledgers, and git log to surface bugs and enhancement candidates, then offers to file them as GitHub issues via `gh issue create` with automatic `dogfood`, `superpowers-overrides`, and conditional `sdd` labels. Includes dedup detection against existing open issues and bilingual (EN/ZH) issue body templates.

Also adds `.github/ISSUE_TEMPLATE/bug_report.yml` and `enhancement.yml` for structured web-UI issue creation with matching field names.
