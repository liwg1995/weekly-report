#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="${ROOT_DIR}/apps/api"
WEB_DIR="${ROOT_DIR}/apps/web"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3000}"
API_HEALTH_URL="${API_BASE_URL}/health"
SKIP_TESTS="${SKIP_TESTS:-0}"
SKIP_MIGRATE="${SKIP_MIGRATE:-0}"

log() {
  echo "[release-readiness] $*"
}

check_env_file() {
  if [[ ! -f "${API_DIR}/.env" ]]; then
    log "apps/api/.env 不存在，请先准备数据库连接与 JWT 配置"
    return 1
  fi
}

run_cmd() {
  local label="$1"
  shift
  log "${label}"
  "$@"
}

wait_for_api() {
  for _ in $(seq 1 45); do
    if curl -fsS "${API_HEALTH_URL}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

main() {
  log "1/8 检查依赖环境与必要文件"
  command -v node >/dev/null 2>&1 || { log "缺少 node"; exit 1; }
  command -v pnpm >/dev/null 2>&1 || { log "缺少 pnpm"; exit 1; }
  check_env_file

  if [[ "${SKIP_TESTS}" == "1" ]]; then
    log "SKIP_TESTS=1，跳过 unit/e2e 验证"
  else
    run_cmd "2/8 API 单测" pnpm --filter api test
    run_cmd "3/8 API e2e" pnpm --filter api test:e2e
    run_cmd "4/8 Web 测试" pnpm --filter web test
  fi

  run_cmd "5/8 API 构建" pnpm --filter api build
  run_cmd "6/8 Web 构建" pnpm --filter web build
  run_cmd "7/8 Prisma generate" pnpm --filter api prisma:generate
  if [[ "${SKIP_MIGRATE}" == "1" ]]; then
    log "SKIP_MIGRATE=1，跳过 Prisma migrate deploy"
  else
    run_cmd "8/8 Prisma migrate deploy" pnpm --filter api exec prisma migrate deploy
  fi

  log "9/9 发布就绪"
  if curl -fsS "${API_HEALTH_URL}" >/dev/null 2>&1; then
    log "API 健康检查通过: ${API_HEALTH_URL}"
  else
    log "API 健康检查未通过（未启动或端口不可达），仅记录为警告，发布前请启动服务后重试"
  fi
}

main "$@"
