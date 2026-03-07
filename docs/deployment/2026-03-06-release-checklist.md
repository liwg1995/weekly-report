# 周报系统发布检查清单（Web + API）

## 1. 环境准备

- Node.js: `>=20`
- 包管理器: `pnpm@10`
- MySQL: `8.x`，已创建数据库 `weekly_report`

API 环境变量（`apps/api/.env`）:

```env
DATABASE_URL="mysql://root:12345678@127.0.0.1:3306/weekly_report"
JWT_SECRET="请替换为生产强随机密钥"
```

Web 环境变量（建议）:

```env
NEXT_PUBLIC_API_BASE_URL="https://your-api-domain"
```

通知开关（API，可选）:

```env
NOTIFY_WECOM_ENABLED="false"
NOTIFY_WECOM_WEBHOOK_URL=""
NOTIFY_DINGTALK_ENABLED="false"
NOTIFY_DINGTALK_WEBHOOK_URL=""
NOTIFY_REVIEW_TEMPLATE=""
NOTIFY_RETRY_MAX_ATTEMPTS="3"
NOTIFY_RETRY_BASE_DELAY_MS="200"
```

说明:

- `NOTIFY_*_ENABLED=true` 且 `NOTIFY_*_WEBHOOK_URL` 有值时，审批通过/驳回会触发对应渠道 webhook。
- `NOTIFY_REVIEW_TEMPLATE` 可配置消息模板，支持变量:
  - `{reportId}` `{decision}` `{reviewerUserId}` `{employeeUserId}` `{comment}`
- 钉钉可选加签:
  - `NOTIFY_DINGTALK_SECRET`
- `NOTIFY_RETRY_MAX_ATTEMPTS` 与 `NOTIFY_RETRY_BASE_DELAY_MS` 控制通知重试（指数退避）。
- `NOTIFY_HTTP_TIMEOUT_MS` 控制单次 webhook 请求超时。
- 当前版本已完成“真实 webhook 请求 + 重试 + 失败兜底（不阻塞审批）”。
- 建议生产使用密钥管理系统注入 webhook，避免明文落盘。

## 2. 发布前检查

在仓库根目录执行:

```bash
pnpm install
pnpm --filter api prisma:generate
pnpm --filter api exec prisma migrate deploy
pnpm test
pnpm --filter api test:e2e
pnpm regression:local
```

通过标准:

- 单元测试与集成测试全部通过
- API e2e 通过（覆盖登录、提交、审批、模板配置、版本回滚）
- 数据库迁移执行成功，包含模板脱敏字段:
  - `review_export_templates.diff_export_mask_sensitive`
  - `review_export_template_versions.diff_export_mask_sensitive`

## 3. 部署步骤

1. 先部署 API。
2. 在 API 实例执行:

```bash
pnpm --filter api prisma:generate
pnpm --filter api exec prisma migrate deploy
pnpm --filter api build
pnpm --filter api start
```

3. 再部署 Web:

```bash
pnpm --filter web build
pnpm --filter web start
```

## 4. 发布后冒烟验证

- 登录成功（管理员账号）
- 员工提交周报成功
- 主管审批通过/驳回成功
- 模板列表可见“差异TXT默认”状态
- 差异TXT导出可用，且脱敏策略符合模板/全局配置
- 快捷切换模板脱敏默认可用（支持取消确认）
- `GET /notifications/channels` 可返回企业微信/钉钉开关状态
- 审批动作在通知失败时不影响主流程（仅记录错误日志）

## 5. 回滚预案

应用回滚:

1. 回滚 API 到上一稳定版本
2. 回滚 Web 到上一稳定版本

数据库回滚:

- 本次迁移为新增列，向后兼容；应用回滚通常无需回滚数据库。
- 若必须回滚数据库，请先确认无线上依赖后再执行手工 SQL。

## 6. 里程碑验证补充（2026-03）

本次完成：绩效配置持久化 + 编辑/删除能力验证通过。

- 执行命令（本地）:
  - `pnpm --filter api test:e2e performance.e2e-spec.ts`
  - `pnpm --filter web test -- performance.test.tsx`
  - `pnpm regression:local`
- 验收口径:
  - 周期：新增/编辑/删除
  - 维度：新增/编辑/删除
  - API 与前端交互一致（按钮行为与状态刷新）
  - 覆盖后回归不影响既有提交/审批/模板链路
