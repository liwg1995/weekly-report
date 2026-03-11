#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[local-dev:restart] stopping services..."
bash "${ROOT_DIR}/scripts/dev-stop.sh"
echo "[local-dev:restart] starting services..."
bash "${ROOT_DIR}/scripts/dev-start.sh"
