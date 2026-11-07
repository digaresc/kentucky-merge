#!/usr/bin/env bash
# Start the 80-minute race N minutes from now (default 2). Usage: bash scripts/start-race.sh [minutes]
set -euo pipefail
cd "$(dirname "$0")/.."
START=$(date -u -v+"${1:-2}"M +%Y-%m-%dT%H:%M:%SZ)
echo "🏁 Gates open at $START (UTC) — that's $(date -v+"${1:-2}"M +%H:%M) your time"
bash scripts/set.sh EVENT_START "$START"
