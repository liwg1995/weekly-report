# 本地交付说明（Weekly Report）

## 1. 适用范围

- 当前版本面向本地试用与验收
- 生产部署、企业微信/钉钉真实发送链路暂未启用

## 2. 一键启动与停止

在项目根目录执行：

```bash
./scripts/dev-start.sh
```

停止：

```bash
./scripts/dev-stop.sh
```

重启：

```bash
./scripts/dev-restart.sh
```

## 3. 默认访问地址

- Web: `http://127.0.0.1:3001`
- API: `http://127.0.0.1:3000`
- API 健康检查: `http://127.0.0.1:3000/health`

## 4. 默认登录账号

- 管理员账号：`admin`
- 默认密码：`123456`（可通过环境变量 `ADMIN_PASSWORD` 覆盖）

说明：
- `admin` 登录后默认进入管理员工作台（组织管理）
- 其他角色账号可在“组织管理”中创建（默认密码同为 `123456`）

## 5. 角色试用路径（建议）

1. 超级管理员 / 部门管理员
   - 组织管理：`/manager/org`
   - 绩效配置：`/manager/performance`
   - 审批管理：`/manager/reviews`
2. 领导 / 经理
   - 审批管理：`/manager/reviews`
3. 员工
   - 我的周报：`/employee/feedback`

## 6. 本地验收建议

先执行自动验证：

```bash
pnpm --filter web test
pnpm --filter web build
pnpm --filter api test
```

再做人工验收：

1. 登录后能进入对应工作台
2. 越权访问会跳转到 `403` 页面（`/forbidden`）
3. 审批页筛选、分页、批量通过/驳回可用
4. 组织管理和绩效配置页面表单交互正常

## 7. 常见问题排查

1. 登录接口跨域报错
   - 优先使用 `dev-start.sh` 启动（已内置 `CORS_ORIGINS`）
2. `Cannot POST /api/auth/login`
   - 通常是 API 未启动或前端 `NEXT_PUBLIC_API_BASE_URL` 未指向 `http://127.0.0.1:3000`
3. 页面打不开
   - 查看日志：
     - `logs/local-dev/api-latest.log`
     - `logs/local-dev/web-latest.log`
