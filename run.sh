#!/usr/bin/env bash
# Start KarLab. First run installs dependencies.
#   ./run.sh        build the UI and serve everything on http://localhost:8000
#   ./run.sh dev    hot-reloading backend (:8000) and UI (:5173) for development
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

(cd "$ROOT/backend" && uv sync -q)
[ -d "$ROOT/frontend/node_modules" ] || (cd "$ROOT/frontend" && npm install --no-fund --no-audit)

if [ "${1:-}" = "dev" ]; then
  (cd "$ROOT/backend" && uv run uvicorn karlab.api:app --reload --port 8000) &
  trap 'kill 0' EXIT
  cd "$ROOT/frontend" && npm run dev
else
  (cd "$ROOT/frontend" && npm run build)
  echo "KarLab running at http://localhost:8000"
  cd "$ROOT/backend" && uv run uvicorn karlab.api:app --port 8000
fi
