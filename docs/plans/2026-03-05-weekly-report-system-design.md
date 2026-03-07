# 员工周报管理系统设计文档（V1）

- 日期：2026-03-05
- 目标读者：产品、研发、测试、运维
- 技术方向：Node.js（NestJS）+ Next.js（React）+ MySQL

## 1. 背景与目标

### 1.1 背景
当前团队缺少统一周报管理与审批系统，导致提交率不稳定、管理层难以实时掌握部门周报完成情况与风险事项。

### 1.2 V1目标
- 提升周报提交率。
- 提升管理可见性（部门、主管、全局维度）。
- 为后续绩效考核预留数据与功能占位，但V1不启用绩效打分逻辑。

### 1.3 非目标（V1不做）
- 企业微信/钉钉消息提醒。
- SSO/OAuth统一登录。
- 绩效考核规则引擎与自动打分。

## 2. 范围与原则

### 2.1 终端范围
- 仅Web后台。

### 2.2 登录方式
- 账号密码登录。

### 2.3 提交频率
- 每周一次，默认周五截止。
- 超级管理员与部门管理员可自定义部门提交日。

### 2.4 组织维护
- 支持手动维护部门/成员。
- 支持Excel批量导入员工与部门关系。

## 3. 角色与权限

### 3.1 超级管理员
- 全局组织管理（部门、成员、主管关系）。
- 全局规则配置（默认提交日、系统开关）。
- 查看全部周报与全局统计。
- 管理导入任务与系统参数。

### 3.2 部门管理员
- 管理本部门成员与提交日规则。
- 查看本部门周报与统计。
- 发起部门内催办（V1先保留入口，可先实现基础标记能力）。

### 3.3 直属主管
- 查看直属下属周报。
- 审批周报（通过/驳回）。
- 填写建议并追踪驳回后重提。

### 3.4 普通员工
- 创建、编辑、提交本人周报。
- 查看本人历史周报与审批意见。

## 4. 核心业务流程

### 4.1 提交流程
1. 员工创建周报草稿。
2. 提交后状态变更为 `PendingApproval`。
3. 系统将该周报流转给直属主管。

### 4.2 审批流程
1. 主管在待审批列表查看周报。
2. 主管选择通过或驳回，并填写建议。
3. 通过：状态 `Approved`。
4. 驳回：状态 `Rejected`，员工可修改后再次提交。

### 4.3 截止与逾期
- 系统按部门提交日计算截止时间。
- 截止后未提交周报标记为 `Overdue`。

### 4.4 审计流程
- 提交、编辑、审批、规则变更、导入等关键操作均记录审计日志。

## 5. MVP功能清单

### 5.1 用户与组织
- 账号密码登录。
- 部门管理、成员管理、主管关系维护。
- Excel导入员工与组织关系。

### 5.2 周报能力
- 周报字段：
  - 本周完成
  - 下周计划
  - 风险/阻塞
  - 需协助事项
- 草稿保存、提交、重提。

### 5.3 审批能力
- 待审批列表。
- 通过/驳回 + 建议。
- 审批历史留痕。

### 5.4 管理可见性
- 总览看板：提交率、逾期率、审批耗时、部门排行。
- 明细筛选：按部门、人员、状态、周期筛选周报。

### 5.5 绩效占位
- 预留字段与Feature Flag，不对业务开放。

## 6. 数据模型（MySQL）

### 6.1 核心表
- `users`
  - `id, username, password_hash, real_name, email, status, created_at`
- `departments`
  - `id, name, parent_id, manager_user_id, report_due_weekday, created_at`
- `user_departments`
  - `id, user_id, department_id, role_in_dept, is_primary`
- `report_cycles`
  - `id, department_id, week_start, week_end, due_at, status`
- `weekly_reports`
  - `id, cycle_id, user_id, status, this_week_text, next_week_text, risks_text, needs_help_text, submitted_at, approved_at, rejected_at, updated_at`
- `report_reviews`
  - `id, report_id, reviewer_user_id, decision, comment, created_at`
- `audit_logs`
  - `id, actor_user_id, action, target_type, target_id, before_json, after_json, created_at`
- `import_jobs`
  - `id, operator_user_id, file_name, status, success_count, fail_count, result_json, created_at`
- `feature_flags`
  - `key, enabled, description`

## 7. API边界（NestJS REST）

### 7.1 认证
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### 7.2 组织与人员
- `GET/POST/PATCH /departments`
- `GET/POST/PATCH /users`
- `POST /imports/employees`

### 7.3 周报与审批
- `GET /report-cycles?departmentId&week`
- `POST /weekly-reports`
- `PATCH /weekly-reports/:id`
- `GET /weekly-reports?scope=self|team|dept|all&status`
- `POST /weekly-reports/:id/review`

### 7.4 看板
- `GET /dashboard/overview?week`
- `GET /dashboard/departments?week`
- `GET /dashboard/users?week`

### 7.5 审计
- `GET /audit-logs?actor&action&dateRange`

## 8. 前端信息架构（Next.js）

### 8.1 登录
- 登录页（账号密码）。

### 8.2 员工端
- 我的周报（本周编辑+历史记录）。
- 审批反馈（查看驳回与建议）。

### 8.3 主管端
- 待我审批（主工作台）。
- 团队周报（筛选查看）。

### 8.4 管理端
- 总览看板。
- 部门视图。
- 组织管理。
- 规则配置。

## 9. UI/交互规范（扁平化、友好）

### 9.1 视觉与结构
- 扁平化样式，减少重阴影与视觉噪音。
- 页面层级不超过3层（列表 -> 抽屉详情 -> 操作弹层）。
- 统一状态标签：待提交、待审批、通过、驳回、逾期。

### 9.2 交互反馈
- 提交类动作提供即时反馈（loading/success/fail）。
- 关键动作按钮固定在主操作区，降低定位成本。
- 空状态、错误状态提供可执行指引。

### 9.3 高效操作
- 列表内提供常用筛选Chip。
- 周报详情优先抽屉展示，减少页面跳转。

## 10. 非功能要求

### 10.1 安全
- 密码加密存储（bcrypt/argon2）。
- 基于角色权限控制接口访问。
- 审计日志不可被普通角色篡改。

### 10.2 性能
- 看板查询支持分页与索引优化。
- 关键列表接口在常规规模下响应<500ms（目标）。

### 10.3 可维护性
- 后端分层模块化（auth/org/report/review/dashboard/audit）。
- 前端按角色场景拆分页面与组件。

## 11. 风险与后续

### 11.1 主要风险
- 组织关系不清会影响审批链路正确性。
- Excel导入格式不一致可能导致数据质量问题。

### 11.2 缓解策略
- 导入前模板校验与错误报告。
- 审批人变更提供回溯与补偿机制。

### 11.3 V2方向
- 接入企业微信/钉钉提醒。
- SSO登录。
- 绩效考核模块启用并与周报数据联动。
