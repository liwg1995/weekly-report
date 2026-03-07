#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${BENCH_BASE_URL:-http://127.0.0.1:3000}"
API_HEALTH_URL="${API_URL}/health"
NEED_CLEANUP=0
API_PID=""

cleanup() {
  if [[ "${NEED_CLEANUP}" -eq 1 && -n "${API_PID}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
    wait "${API_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_api() {
  for _ in $(seq 1 60); do
    if curl -fsS "${API_HEALTH_URL}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "[local-regression] 1/4 API unit tests"
pnpm --filter api test

echo "[local-regression] 2/4 API e2e tests"
pnpm --filter api test:e2e

echo "[local-regression] 3/4 Web tests"
pnpm --filter web test

if curl -fsS "${API_HEALTH_URL}" >/dev/null 2>&1; then
  echo "[local-regression] detected running API at ${API_URL}"
else
  echo "[local-regression] starting API for benchmark"
  (
    cd "${ROOT_DIR}" && pnpm --filter api start
  ) >/tmp/weekly-report-api-regression.log 2>&1 &
  API_PID=$!
  NEED_CLEANUP=1
  if ! wait_for_api; then
    echo "[local-regression] API failed to start, see /tmp/weekly-report-api-regression.log"
    exit 1
  fi
fi

echo "[local-regression] 4/4 API benchmark"
pnpm --filter api benchmark:local

echo "[local-regression] completed"
