# 本地压测基线（API）

日期：2026-03-06  
环境：本地开发机（MySQL `weekly_report`）

## 执行命令

在仓库根目录执行：

```bash
pnpm --filter api start
pnpm --filter api benchmark:local
```

默认参数（可通过环境变量覆盖）：

- `BENCH_BASE_URL=http://127.0.0.1:3000`
- `BENCH_USERNAME=admin`
- `BENCH_PASSWORD=123456`
- `BENCH_REQUESTS=120`
- `BENCH_CONCURRENCY=12`

## 基线结果

登录：

- `login: ok (106.34ms)`

接口 1：`GET /weekly-reports?status=PENDING_APPROVAL`

- 成功率：`120/120 (100.00%)`
- 延迟：`avg=20.06ms` `p50=19.11ms` `p95=27.65ms` `max=32.78ms`

接口 2：`GET /audit-logs/reviews?limit=10`

- 成功率：`120/120 (100.00%)`
- 延迟：`avg=6.20ms` `p50=5.96ms` `p95=7.56ms` `max=10.77ms`

接口 3：`GET /notifications/channels`

- 成功率：`120/120 (100.00%)`
- 延迟：`avg=3.49ms` `p50=3.49ms` `p95=4.68ms` `max=5.32ms`

## 使用说明

- 建议每次涉及审批链路、模板导出、通知模块调整后执行一次本地压测并更新本文件。
- 如发现 `p95` 明显上升，可先复查：
  - MySQL 连接状态和慢查询
  - 审批日志/模板查询是否新增复杂联表
  - 通知配置是否误开启真实 webhook
