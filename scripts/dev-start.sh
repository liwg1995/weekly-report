#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="${ROOT_DIR}/apps/api"
WEB_DIR="${ROOT_DIR}/apps/web"

API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:${WEB_PORT}}"
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT},http://localhost:3000,http://127.0.0.1:3000}"

API_PID_FILE="${ROOT_DIR}/.tmp-api-dev.pid"
WEB_PID_FILE="${ROOT_DIR}/.tmp-web-dev.pid"
LOG_DIR="${ROOT_DIR}/logs/local-dev"
LOG_TS="$(date +%Y%m%d-%H%M%S)"
API_LOG_FILE="${LOG_DIR}/api-${LOG_TS}.log"
WEB_LOG_FILE="${LOG_DIR}/web-${LOG_TS}.log"
API_LATEST_LINK="${LOG_DIR}/api-latest.log"
WEB_LATEST_LINK="${LOG_DIR}/web-latest.log"

log() {
  echo "[local-dev:start] $*"
}

is_pid_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

wait_for_api() {
  local retry=0
  local max_retry=90
  while ((retry < max_retry)); do
    if curl -fsS "${API_BASE_URL}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    ((retry++))
  done
  return 1
}

wait_for_web() {
  local retry=0
  local max_retry=90
  while ((retry < max_retry)); do
    if curl -fsS "${WEB_BASE_URL}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    ((retry++))
  done
  return 1
}

start_api() {
  log "启动 API -> ${API_BASE_URL}"
  cd "${API_DIR}"
  PORT="${API_PORT}" \
  CORS_ORIGINS="${CORS_ORIGINS}" \
  nohup pnpm start >"${API_LOG_FILE}" 2>&1 < /dev/null &
  echo $! > "${API_PID_FILE}"
  cd "${ROOT_DIR}"

  if ! wait_for_api; then
    log "API 启动超时，请查看日志: ${API_LOG_FILE}"
    exit 1
  fi
  log "API 启动完成，PID=$(cat "${API_PID_FILE}")"
}

start_web() {
  log "启动 Web -> ${WEB_BASE_URL}"
  cd "${WEB_DIR}"
  PORT="${WEB_PORT}" \
  NEXT_PUBLIC_API_BASE_URL="${API_BASE_URL}" \
  nohup pnpm dev >"${WEB_LOG_FILE}" 2>&1 < /dev/null &
  echo $! > "${WEB_PID_FILE}"
  cd "${ROOT_DIR}"

  if ! wait_for_web; then
    log "Web 启动超时，请查看日志: ${WEB_LOG_FILE}"
    exit 1
  fi
  log "Web 启动完成，PID=$(cat "${WEB_PID_FILE}")"
}

main() {
  mkdir -p "${LOG_DIR}"

  if [[ -f "${API_PID_FILE}" ]] && is_pid_running "$(cat "${API_PID_FILE}" 2>/dev/null || true)"; then
    log "检测到 API 已在运行，先执行停止..."
    bash "${ROOT_DIR}/scripts/dev-stop.sh" >/dev/null
  fi
  if [[ -f "${WEB_PID_FILE}" ]] && is_pid_running "$(cat "${WEB_PID_FILE}" 2>/dev/null || true)"; then
    log "检测到 Web 已在运行，先执行停止..."
    bash "${ROOT_DIR}/scripts/dev-stop.sh" >/dev/null
  fi

  start_api
  start_web

  ln -sfn "${API_LOG_FILE}" "${API_LATEST_LINK}"
  ln -sfn "${WEB_LOG_FILE}" "${WEB_LATEST_LINK}"

  log "完成：本地服务已启动"
  log "API: ${API_BASE_URL}"
  log "Web: ${WEB_BASE_URL}"
  log "默认管理员账号: admin / ${ADMIN_PASSWORD:-123456}"
  log "日志文件:"
  log "  API: ${API_LOG_FILE}"
  log "  Web: ${WEB_LOG_FILE}"
  log "最新日志软链:"
  log "  API: ${API_LATEST_LINK}"
  log "  Web: ${WEB_LATEST_LINK}"
}

main "$@"
