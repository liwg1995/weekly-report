#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"

API_PID_FILE="${ROOT_DIR}/.tmp-api-dev.pid"
WEB_PID_FILE="${ROOT_DIR}/.tmp-web-dev.pid"

log() {
  echo "[local-dev:stop] $*"
}

stop_pid_file() {
  local file="$1"
  local name="$2"
  if [[ ! -f "${file}" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "${file}" 2>/dev/null || true)"
  rm -f "${file}"
  if [[ -z "${pid}" ]]; then
    return 0
  fi
  if kill -0 "${pid}" >/dev/null 2>&1; then
    log "停止 ${name} 进程 PID=${pid}"
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "${pid}" >/dev/null 2>&1; then
      log "${name} 进程未退出，强制结束 PID=${pid}"
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
  fi
}

kill_port() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "${pids}" ]]; then
    return 0
  fi
  log "清理端口 ${port} 监听进程: ${pids}"
  kill ${pids} >/dev/null 2>&1 || true
  sleep 1
  local remain
  remain="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${remain}" ]]; then
    kill -9 ${remain} >/dev/null 2>&1 || true
  fi
}

main() {
  stop_pid_file "${API_PID_FILE}" "API"
  stop_pid_file "${WEB_PID_FILE}" "Web"

  kill_port "${API_PORT}"
  kill_port "${WEB_PORT}"

  log "完成：本地服务已停止"
}

main "$@"
