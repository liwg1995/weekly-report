#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="${ROOT_DIR}/apps/api"
WEB_DIR="${ROOT_DIR}/apps/web"

API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT},http://localhost:3000,http://127.0.0.1:3000}"
STOP_FIRST="${STOP_FIRST:-1}"
WAIT_FOR_API="${WAIT_FOR_API:-1}"

API_PID_FILE="${ROOT_DIR}/.tmp-api-dev.pid"
WEB_PID_FILE="${ROOT_DIR}/.tmp-web-dev.pid"
API_LOG_FILE="${ROOT_DIR}/.tmp-api-dev.log"
WEB_LOG_FILE="${ROOT_DIR}/.tmp-web-dev.log"

log() {
  echo "[local-dev] $*"
}

kill_port() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  log "停止监听端口 ${port} 的进程: ${pids}"
  kill $pids >/dev/null 2>&1 || true
  sleep 1
  local remain
  remain="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$remain" ]]; then
    log "端口 ${port} 存在残留进程，强制退出: ${remain}"
    kill -9 $remain >/dev/null 2>&1 || true
  fi
}

cleanup_pid_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      log "停止旧进程 pid=${pid}"
      kill "$pid" >/dev/null 2>&1 || true
      sleep 1
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  fi
}

wait_for_api() {
  local retry=0
  local max_retry=60
  while ((retry < max_retry)); do
    if curl -fsS "${API_BASE_URL}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    ((retry++))
  done
  return 1
}

start_api() {
  log "启动 API -> ${API_BASE_URL}"
  cleanup_pid_file "$API_PID_FILE"
  cd "$API_DIR"
  PORT="$API_PORT" \
  CORS_ORIGINS="$CORS_ORIGINS" \
  nohup pnpm start \
    >"$API_LOG_FILE" 2>&1 < /dev/null &
  echo $! > "$API_PID_FILE"
  cd "$ROOT_DIR"

  if [[ "${WAIT_FOR_API}" != "0" ]]; then
    if ! wait_for_api; then
      log "API 启动超时，请查看日志: ${API_LOG_FILE}"
      exit 1
    fi
  else
    log "已跳过 API 启动等待（WAIT_FOR_API=0）"
  fi
  log "API 已启动，日志: ${API_LOG_FILE}"
}

start_web() {
  log "启动 Web -> ${ROOT_DIR}/apps/web (PORT=${WEB_PORT})"
  cleanup_pid_file "$WEB_PID_FILE"
  cd "$WEB_DIR"
  PORT="$WEB_PORT" \
  NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" \
  nohup pnpm dev \
    >"$WEB_LOG_FILE" 2>&1 < /dev/null &
  echo $! > "$WEB_PID_FILE"
  cd "$ROOT_DIR"
  log "Web 已启动，日志: ${WEB_LOG_FILE}"
  log "Web 访问地址: http://localhost:${WEB_PORT}"
}

main() {
  if [[ "$STOP_FIRST" != "0" ]]; then
    kill_port "$API_PORT"
    kill_port "$WEB_PORT"
  fi

  start_api
  start_web

  log "完成：本地服务已启动"
  log "API: ${API_BASE_URL}"
  log "Web: http://localhost:${WEB_PORT}"
  log "默认管理员账号: admin / ${ADMIN_PASSWORD:-123456}"
  log "如需修改管理员密码，请在启动前设置 ADMIN_PASSWORD 环境变量"
  log "如需自定义域名端口，可在环境中设置 CORS_ORIGINS / API_PORT / WEB_PORT / API_BASE_URL"
}

main "$@"
