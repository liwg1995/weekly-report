# Weekly Report System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a V1 weekly report management system that improves submission rate and management visibility with employee submission + manager approval workflows.

**Architecture:** Use a monorepo with `apps/api` (NestJS) and `apps/web` (Next.js). API provides auth, org, report, review, dashboard, and audit modules over MySQL via Prisma. Web provides role-based workspaces (employee/manager/admin) with a flat dashboard-first UX.

**Tech Stack:** Node.js 22, pnpm, NestJS, Next.js (App Router), Prisma, MySQL, Jest, React Testing Library, Playwright

---

### Task 1: Monorepo Bootstrap

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `.gitignore`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`

**Step 1: Write the failing test**

```bash
pnpm -r test
```

Expected: command fails because workspace and projects are not initialized.

**Step 2: Create minimal workspace config**

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
```

```json
{
  "name": "weekly-report-system",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "test": "pnpm -r test"
  }
}
```

**Step 3: Run test command to verify workspace resolves**

Run: `pnpm -r test`  
Expected: command reaches package-level test scripts (may fail later for unimplemented tests).

**Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json .gitignore apps/api/package.json apps/web/package.json
git commit -m "chore: bootstrap monorepo for api and web"
```

### Task 2: API Project Skeleton (NestJS + Jest)

**Files:**
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/app.controller.ts`
- Create: `apps/api/test/app.e2e-spec.ts`

**Step 1: Write the failing test**

```ts
// apps/api/test/app.e2e-spec.ts
it("/health (GET) returns 200", async () => {
  await request(app.getHttpServer()).get("/health").expect(200);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test:e2e`  
Expected: FAIL because app bootstrap/routes are missing.

**Step 3: Write minimal implementation**

```ts
// apps/api/src/app.controller.ts
@Controller()
export class AppController {
  @Get("health")
  health() {
    return { ok: true };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test:e2e`  
Expected: PASS for `/health`.

**Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): initialize nest app with health endpoint"
```

### Task 3: Database Schema (Prisma + MySQL)

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/*`
- Create: `apps/api/src/prisma/prisma.service.ts`
- Test: `apps/api/test/prisma-schema.spec.ts`

**Step 1: Write the failing test**

```ts
// apps/api/test/prisma-schema.spec.ts
it("contains weekly_reports and report_reviews tables", async () => {
  const tables = await prisma.$queryRaw`SHOW TABLES`;
  expect(JSON.stringify(tables)).toContain("weekly_reports");
  expect(JSON.stringify(tables)).toContain("report_reviews");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test prisma-schema.spec.ts -v`  
Expected: FAIL because schema/migration not created.

**Step 3: Write minimal implementation**

Create Prisma models for:
- `User`
- `Department`
- `UserDepartment`
- `ReportCycle`
- `WeeklyReport`
- `ReportReview`
- `AuditLog`
- `ImportJob`
- `FeatureFlag`

Then run: `pnpm --filter api prisma migrate dev`

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test prisma-schema.spec.ts -v`  
Expected: PASS and target tables exist.

**Step 5: Commit**

```bash
git add apps/api/prisma apps/api/src/prisma apps/api/test/prisma-schema.spec.ts
git commit -m "feat(api): add prisma schema and initial migration"
```

### Task 4: Auth Module (Account/Password + RBAC Guard)

**Files:**
- Create: `apps/api/src/modules/auth/*`
- Create: `apps/api/src/modules/common/guards/roles.guard.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Step 1: Write the failing test**

```ts
it("POST /auth/login returns token for valid credentials", async () => {
  const res = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ username: "admin", password: "123456" })
    .expect(201);
  expect(res.body.accessToken).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test:e2e auth.e2e-spec.ts`  
Expected: FAIL because auth module is missing.

**Step 3: Write minimal implementation**

Implement:
- password hash verify (`bcrypt`)
- JWT issue
- `/auth/login`, `/auth/me`, `/auth/logout`
- role-based decorator + guard

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test:e2e auth.e2e-spec.ts`  
Expected: PASS for login and protected `/auth/me`.

**Step 5: Commit**

```bash
git add apps/api/src/modules/auth apps/api/src/modules/common/guards apps/api/test/auth.e2e-spec.ts
git commit -m "feat(api): implement password auth and role guard"
```

### Task 5: Organization Module (Department/User + Excel Import)

**Files:**
- Create: `apps/api/src/modules/org/*`
- Create: `apps/api/src/modules/imports/*`
- Test: `apps/api/test/org.e2e-spec.ts`

**Step 1: Write the failing test**

```ts
it("admin can create department with due weekday", async () => {
  await request(app.getHttpServer())
    .post("/departments")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "R&D", reportDueWeekday: 5 })
    .expect(201);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test:e2e org.e2e-spec.ts`  
Expected: FAIL because endpoints do not exist.

**Step 3: Write minimal implementation**

Implement:
- `GET/POST/PATCH /departments`
- `GET/POST/PATCH /users`
- `POST /imports/employees` (xlsx parse + validation report)

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test:e2e org.e2e-spec.ts`  
Expected: PASS for create/update/query and import job creation.

**Step 5: Commit**

```bash
git add apps/api/src/modules/org apps/api/src/modules/imports apps/api/test/org.e2e-spec.ts
git commit -m "feat(api): add organization management and excel import"
```

### Task 6: Weekly Report Module (Draft/Submit/Resubmit)

**Files:**
- Create: `apps/api/src/modules/reports/*`
- Test: `apps/api/test/reports.e2e-spec.ts`

**Step 1: Write the failing test**

```ts
it("employee can submit weekly report and becomes pending approval", async () => {
  const res = await request(app.getHttpServer())
    .post("/weekly-reports")
    .set("Authorization", `Bearer ${employeeToken}`)
    .send({ cycleId, thisWeekText: "done", nextWeekText: "plan", risksText: "", needsHelpText: "" })
    .expect(201);
  expect(res.body.status).toBe("PENDING_APPROVAL");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test:e2e reports.e2e-spec.ts`  
Expected: FAIL because report module is missing.

**Step 3: Write minimal implementation**

Implement:
- create/edit draft
- submit -> `PENDING_APPROVAL`
- rejected report resubmit path
- list by scope/status

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test:e2e reports.e2e-spec.ts`  
Expected: PASS for submit and resubmit flows.

**Step 5: Commit**

```bash
git add apps/api/src/modules/reports apps/api/test/reports.e2e-spec.ts
git commit -m "feat(api): implement weekly report submit and resubmit flow"
```

### Task 7: Review Module (Approve/Reject + Suggestion)

**Files:**
- Create: `apps/api/src/modules/reviews/*`
- Test: `apps/api/test/reviews.e2e-spec.ts`

**Step 1: Write the failing test**

```ts
it("manager can reject report with suggestion", async () => {
  const res = await request(app.getHttpServer())
    .post(`/weekly-reports/${reportId}/review`)
    .set("Authorization", `Bearer ${managerToken}`)
    .send({ decision: "REJECTED", comment: "Please clarify risks." })
    .expect(201);
  expect(res.body.decision).toBe("REJECTED");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test:e2e reviews.e2e-spec.ts`  
Expected: FAIL because review module is missing.

**Step 3: Write minimal implementation**

Implement:
- review permission check (direct manager only)
- approve/reject write path
- report status update
- immutable review history

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test:e2e reviews.e2e-spec.ts`  
Expected: PASS for approve and reject with comment.

**Step 5: Commit**

```bash
git add apps/api/src/modules/reviews apps/api/test/reviews.e2e-spec.ts
git commit -m "feat(api): add manager review workflow"
```

### Task 8: Dashboard + Audit Modules

**Files:**
- Create: `apps/api/src/modules/dashboard/*`
- Create: `apps/api/src/modules/audit/*`
- Test: `apps/api/test/dashboard.e2e-spec.ts`
- Test: `apps/api/test/audit.e2e-spec.ts`

**Step 1: Write the failing tests**

```ts
it("GET /dashboard/overview returns submit and overdue metrics", async () => {
  const res = await request(app.getHttpServer())
    .get("/dashboard/overview?week=2026-W10")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
  expect(res.body.submissionRate).toBeDefined();
});
```

```ts
it("GET /audit-logs returns submit/review actions", async () => {
  const res = await request(app.getHttpServer())
    .get("/audit-logs")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
  expect(Array.isArray(res.body.items)).toBe(true);
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test:e2e dashboard.e2e-spec.ts audit.e2e-spec.ts`  
Expected: FAIL because modules are missing.

**Step 3: Write minimal implementation**

Implement:
- `GET /dashboard/overview|departments|users`
- `GET /audit-logs`
- add audit hooks in submit/review/config/import actions

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test:e2e dashboard.e2e-spec.ts audit.e2e-spec.ts`  
Expected: PASS with valid metrics and logs.

**Step 5: Commit**

```bash
git add apps/api/src/modules/dashboard apps/api/src/modules/audit apps/api/test/dashboard.e2e-spec.ts apps/api/test/audit.e2e-spec.ts
git commit -m "feat(api): add dashboard metrics and audit log query"
```

### Task 9: Web App Foundation (Next.js + Design System Tokens)

**Files:**
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/components/ui/*`
- Test: `apps/web/src/app/login/login.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders login form with username and password", () => {
  render(<LoginPage />);
  expect(screen.getByLabelText("用户名")).toBeInTheDocument();
  expect(screen.getByLabelText("密码")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test login.test.tsx -v`  
Expected: FAIL because page/components do not exist.

**Step 3: Write minimal implementation**

Implement flat UI tokens in `tokens.css`:
- neutral background
- clear status colors
- spacing and radius scale

Build login page with form + loading + error feedback states.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test login.test.tsx -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/login apps/web/src/styles/tokens.css apps/web/src/components/ui
git commit -m "feat(web): create flat design tokens and login page"
```

### Task 10: Employee Workspace (My Reports + Feedback)

**Files:**
- Create: `apps/web/src/app/employee/reports/page.tsx`
- Create: `apps/web/src/app/employee/feedback/page.tsx`
- Create: `apps/web/src/components/reports/report-editor.tsx`
- Test: `apps/web/src/app/employee/reports/reports.test.tsx`

**Step 1: Write the failing test**

```tsx
it("submits report and shows pending approval badge", async () => {
  render(<EmployeeReportsPage />);
  await user.click(screen.getByRole("button", { name: "提交周报" }));
  expect(await screen.findByText("待审批")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test reports.test.tsx -v`  
Expected: FAIL because page and editor are missing.

**Step 3: Write minimal implementation**

Implement:
- report editor form (4 sections)
- draft save + submit actions
- feedback list for rejected reports and suggestions

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test reports.test.tsx -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/employee apps/web/src/components/reports
git commit -m "feat(web): add employee report submit and feedback pages"
```

### Task 11: Manager/Admin Workspace (Approval + Dashboard + Org)

**Files:**
- Create: `apps/web/src/app/manager/reviews/page.tsx`
- Create: `apps/web/src/app/admin/dashboard/page.tsx`
- Create: `apps/web/src/app/admin/org/page.tsx`
- Test: `apps/web/src/app/manager/reviews/reviews.test.tsx`

**Step 1: Write the failing test**

```tsx
it("manager can approve or reject with comment", async () => {
  render(<ManagerReviewsPage />);
  expect(screen.getByRole("button", { name: "通过" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "驳回" })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test reviews.test.tsx -v`  
Expected: FAIL because manager workspace is missing.

**Step 3: Write minimal implementation**

Implement:
- pending review queue with drawer detail
- approve/reject modal with required suggestion input
- admin dashboard cards + dept/user table
- org management with manual edit + import upload entry

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test reviews.test.tsx -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/manager apps/web/src/app/admin
git commit -m "feat(web): add manager approval and admin visibility pages"
```

### Task 12: End-to-End Verification + Docs

**Files:**
- Create: `README.md`
- Create: `docs/api.md`
- Create: `docs/deploy.md`
- Create: `apps/web/e2e/approval-flow.spec.ts`

**Step 1: Write the failing E2E test**

```ts
test("employee submit -> manager approve -> admin sees metrics", async ({ page }) => {
  // login as employee and submit
  // login as manager and approve
  // login as admin and verify dashboard
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test:e2e approval-flow.spec.ts`  
Expected: FAIL because full flow is not wired yet.

**Step 3: Write minimal implementation/docs**

Implement missing wiring until E2E passes, then document:
- local setup
- env vars
- migration commands
- test commands
- release checklist

**Step 4: Run full verification**

Run:
- `pnpm -r lint`
- `pnpm -r test`
- `pnpm --filter web test:e2e`

Expected: PASS.

**Step 5: Commit**

```bash
git add README.md docs apps/web/e2e
git commit -m "docs: add runbook and validate end-to-end workflow"
```
