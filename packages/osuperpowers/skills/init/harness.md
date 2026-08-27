# init harness

`init harness` installs per-harness osuperpowers configuration (detect / guide / write native config / trust ceremony / summarize) so that the osuperpowers:*/cli-* trigger self-checks take effect across all installed harnesses. Under the hood it runs `node <plugin-root>/bin/init/install-harness.mjs` from the **installed package** (`<plugin-root>` = wherever the marketplace actually installed osuperpowers, not the source checkout path).

```text
/init harness [--harness …] [--dry-run]
```

```mermaid
flowchart TD
  A[detect] -->|detected >= 1| B[guide]
  A -->|detected = 0| S((APPROVED: harness-installed))
  B --> C[config]
  C --> D[trust]
  D --> E[summarize]
  E --> F((APPROVED: harness-installed))
```

### detect

- **Do**: Use the harness-detect util (`command -v <cli>`; `cli` source = `config.harnesses[h].cli ?? h`) to detect installed harnesses; `unknown --harness` → util exits 1. An `install-and-use` channel harness, once detected, proceeds straight to guide (guide only prints the probe + install hint, writes no files).
- **Read**: `config.harnesses` (installed-package config); `--harness` / `--dry-run` arguments
- **Exit**: `detected ≥ 1` → `guide`; `detected = 0` → APPROVED (harness-installed, skip — skipping an undetected harness is expected behavior)
- **Fail**: Unknown `--harness` → exit 1 (caller handles); `--dry-run` only previews, writes no files

### guide

- **Do**: The `install-and-use` channel prints the probe + install hint without writing any files; `--dry-run` only previews.
- **Read**: The list of detected harnesses
- **Exit**: Guidance done → `config`
- **Fail**: None (guidance writes no files, no side effects)

### config

- **Do**: The init channel (native harness): write config (template derived from `configs/`) + copy skills; JSON deep-merge / TOML append, preserving the user's non-conflicting content (idempotent). **An `install-and-use` channel harness is a no-op / skip at this node** (its install goes through guide's package-channel hint; config writing does not apply).
- **Read**: `configs/` templates; already-written config (for idempotent merge)
- **Exit**: Config written / skipped → `trust`
- **Fail**: File write failure → fail-open (report the error, keep parts already written, prompt the user to check manually)

### trust

- **Do**: Writing config ≠ trust taking effect. For harnesses that need a trust ceremony, guide the user to perform it (grok `grok --trust`, codex `/hooks`, gemini first-time fingerprint acceptance, trae Enable + sandbox/local). **Harnesses with no corresponding trust ceremony (e.g. the `install-and-use` channel) skip this step**; summarize marks them "active" rather than "needs manual trust".
- **Read**: The list of harnesses with config written
- **Exit**: Summarize trust steps → `summarize`
- **Fail**: User skips trust → still APPROVED, but summarize explicitly marks "needs manual trust"

### summarize

- **Do**: Summarize each harness's status: config written (active) / guided through package channel (user must install the package) / skipped (not detected) + any steps requiring manual trust. These three states align with the output of detect/config/trust.
- **Read**: Status of the detect / config / trust nodes
- **Exit**: Output summary → APPROVED (harness-installed)
- **Fail**: None (display only)

## Invariants

| # | Invariant |
|---|---|
| I1 | **Idempotent** — re-running overwrites config (JSON deep-merge / TOML append), preserving the user's manually appended non-conflicting content |
| I2 | **Dry-Run-First** — on first run (or when impact is unknown), preview the paths to be written with `--dry-run` first; never silently write files |
| I3 | **Config ≠ Trust** — writing config does not imply trust has taken effect; the trust ceremony must be explicitly guided for the user to perform |

## Failure Modes

| failure | behavior | reason | recovery |
|---|---|---|---|
| Unknown `--harness` | exit 1 | Util rejects unknown harness | Suggest the list of available harnesses |
| `config` file write failure | fail-open (report + keep parts written) | Filesystem permission / wrong path | Prompt the user to check path permissions manually |
| User skips trust ceremony | APPROVED (marked needs manual trust) | Trust is a user-side decision | summarize explicitly lists the trust steps still to perform |
