#!/usr/bin/env bash
# sdd-run-task-copilot.sh — Copilot stub harness (p1): exit 1 BLOCKED
#
# Stub: orchestrator must BLOCK (not p0 fallback). See spor-token-efficient-controller-handoff H6.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/sdd-common.sh
source "${SCRIPT_DIR}/lib/sdd-common.sh"

sdd_stderr_harness_stub copilot "harness not implemented in p1"
sdd_exit_blocked
