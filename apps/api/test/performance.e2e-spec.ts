import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("Performance (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken = "";

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    prisma = moduleFixture.get(PrismaService);
    app = moduleFixture.createNestApplication();
    await app.init();

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "admin", password: "123456" })
      .expect(201);
    adminToken = login.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  it("manager-side role can read performance overview", async () => {
    const result = await request(app.getHttpServer())
      .get("/performance/overview")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(result.body.cycles)).toBe(true);
    expect(Array.isArray(result.body.todos)).toBe(true);
    expect(result.body.cycles.length).toBeGreaterThan(0);
    expect(result.body.cycles[0].dimensions.length).toBeGreaterThan(0);
    expect(result.body.todos.length).toBeGreaterThan(0);
  });

  it("employee role cannot read performance overview", async () => {
    const unique = Date.now();
    const username = `perf_emp_${unique}`;

    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username, realName: "Performance Employee" })
      .expect(201);

    const employeeLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username, password: "123456" })
      .expect(201);

    await request(app.getHttpServer())
      .get("/performance/overview")
      .set("Authorization", `Bearer ${employeeLogin.body.accessToken}`)
      .expect(403);
  });

  it("manager-side role can create cycle, add dimension and update todo", async () => {
    const createdCycle = await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "2026Q3 绩效周期（草案）",
        startDate: "2026-07-01",
        endDate: "2026-09-30",
        status: "DRAFT"
      })
      .expect(201);

    expect(createdCycle.body.name).toBe("2026Q3 绩效周期（草案）");

    const createdDimension = await request(app.getHttpServer())
      .post(`/performance/cycles/${createdCycle.body.id}/dimensions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "quality",
        name: "质量改进",
        weight: 20,
        metricHint: "按缺陷闭环率评估"
      })
      .expect(201);

    expect(createdDimension.body.key).toBe("quality");

    const overview = await request(app.getHttpServer())
      .get("/performance/overview")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const firstTodoId = overview.body.todos[0].id as number;
    const updatedTodo = await request(app.getHttpServer())
      .patch(`/performance/todos/${firstTodoId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ done: true })
      .expect(200);

    expect(updatedTodo.body.done).toBe(true);
  });

  it("should write audit log for cycle create/update/delete", async () => {
    const admin = await prisma.user.findFirst({ where: { username: "admin" } });
    if (!admin) {
      throw new Error("管理员账号不存在");
    }

    const createdCycle = await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `2026Q10 审计测试 ${Date.now()}`,
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        status: "DRAFT"
      })
      .expect(201);

    const createdLog = await prisma.auditLog.findFirst({
      where: {
        actorUserId: admin.id,
        action: "PERFORMANCE_CYCLE_CREATED",
        targetType: "performance_cycle",
        targetId: String(createdCycle.body.id)
      },
      orderBy: { createdAt: "desc" }
    });
    expect(createdLog).toBeTruthy();
    expect(createdLog?.afterJson).toBeTruthy();
    expect(createdLog?.beforeJson).toBeNull();

    const updatedCycle = await request(app.getHttpServer())
      .patch(`/performance/cycles/${createdCycle.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `2026Q10 审计测试（已更新）${Date.now()}`,
        status: "ACTIVE"
      })
      .expect(200);

    const updatedLog = await prisma.auditLog.findFirst({
      where: {
        actorUserId: admin.id,
        action: "PERFORMANCE_CYCLE_UPDATED",
        targetType: "performance_cycle",
        targetId: String(updatedCycle.body.id)
      },
      orderBy: { createdAt: "desc" }
    });
    expect(updatedLog).toBeTruthy();
    expect(updatedLog?.beforeJson).toBeTruthy();
    expect(updatedLog?.afterJson).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/performance/cycles/${createdCycle.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const deletedLog = await prisma.auditLog.findFirst({
      where: {
        actorUserId: admin.id,
        action: "PERFORMANCE_CYCLE_DELETED",
        targetType: "performance_cycle",
        targetId: String(createdCycle.body.id)
      },
      orderBy: { createdAt: "desc" }
    });
    expect(deletedLog).toBeTruthy();
    expect(deletedLog?.beforeJson).toBeTruthy();
    expect(deletedLog?.afterJson).toBeNull();
  });

  it("should write audit log for dimension create/update/delete", async () => {
    const admin = await prisma.user.findFirst({ where: { username: "admin" } });
    if (!admin) {
      throw new Error("管理员账号不存在");
    }

    const createdCycle = await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `2026Q11 审计测试 ${Date.now()}`,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        status: "DRAFT"
      })
      .expect(201);

    const createdDimension = await request(app.getHttpServer())
      .post(`/performance/cycles/${createdCycle.body.id}/dimensions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: `quality_${Date.now()}`,
        name: "质量",
        weight: 30,
        metricHint: "按质量维度评估"
      })
      .expect(201);

    const dimensionCreateLog = await prisma.auditLog.findFirst({
      where: {
        actorUserId: admin.id,
        action: "PERFORMANCE_DIMENSION_CREATED",
        targetType: "performance_dimension",
        targetId: String(createdDimension.body.id)
      },
      orderBy: { createdAt: "desc" }
    });
    expect(dimensionCreateLog).toBeTruthy();
    expect(dimensionCreateLog?.afterJson).toBeTruthy();

    const updatedDimension = await request(app.getHttpServer())
      .patch(`/performance/dimensions/${createdDimension.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        weight: 40,
        metricHint: "按质量指标改进幅度与闭环率"
      })
      .expect(200);

    const dimensionUpdateLog = await prisma.auditLog.findFirst({
      where: {
        actorUserId: admin.id,
        action: "PERFORMANCE_DIMENSION_UPDATED",
        targetType: "performance_dimension",
        targetId: String(updatedDimension.body.id)
      },
      orderBy: { createdAt: "desc" }
    });
    expect(dimensionUpdateLog).toBeTruthy();
    expect(dimensionUpdateLog?.beforeJson).toBeTruthy();
    expect(dimensionUpdateLog?.afterJson).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/performance/dimensions/${createdDimension.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const dimensionDeleteLog = await prisma.auditLog.findFirst({
      where: {
        actorUserId: admin.id,
        action: "PERFORMANCE_DIMENSION_DELETED",
        targetType: "performance_dimension",
        targetId: String(createdDimension.body.id)
      },
      orderBy: { createdAt: "desc" }
    });
    expect(dimensionDeleteLog).toBeTruthy();
    expect(dimensionDeleteLog?.beforeJson).toBeTruthy();
    expect(dimensionDeleteLog?.afterJson).toBeNull();

    await request(app.getHttpServer())
      .delete(`/performance/cycles/${createdCycle.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("should reject add dimension when total weight exceeds 100", async () => {
    const createdCycle = await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "2026Q7 权重边界",
        startDate: "2026-07-01",
        endDate: "2026-09-30",
        status: "DRAFT"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${createdCycle.body.id}/dimensions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "quality",
        name: "质量",
        weight: 60,
        metricHint: "按质量"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${createdCycle.body.id}/dimensions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "innovation",
        name: "创新",
        weight: 60,
        metricHint: "按创新"
      })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/performance/cycles/${createdCycle.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("should reject cycle name longer than 64 characters", async () => {
    await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "超长周期名称_".repeat(10),
        startDate: "2026-11-01",
        endDate: "2026-11-30"
      })
      .expect(400);
  });

  it("manager-side role can update and delete cycle", async () => {
    const createdCycle = await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "2026Q5 绩效周期（编辑）",
        startDate: "2026-01-01",
        endDate: "2026-03-31",
        status: "DRAFT"
      })
      .expect(201);

    const updatedCycle = await request(app.getHttpServer())
      .patch(`/performance/cycles/${createdCycle.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "2026Q5 绩效周期（已更新）",
        status: "ACTIVE"
      })
      .expect(200);

    expect(updatedCycle.body.name).toBe("2026Q5 绩效周期（已更新）");
    expect(updatedCycle.body.status).toBe("ACTIVE");

    await request(app.getHttpServer())
      .delete(`/performance/cycles/${createdCycle.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("manager-side role can update and delete dimension", async () => {
    const createdCycle = await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "2026Q6 绩效周期（维度）",
        startDate: "2026-04-01",
        endDate: "2026-06-30",
        status: "DRAFT"
      })
      .expect(201);

    const createdDimension = await request(app.getHttpServer())
      .post(`/performance/cycles/${createdCycle.body.id}/dimensions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "efficiency",
        name: "效率",
        weight: 25,
        metricHint: "按任务交付效率评估"
      })
      .expect(201);

    const updatedDimension = await request(app.getHttpServer())
      .patch(`/performance/dimensions/${createdDimension.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "效率改进",
        metricHint: "按交付效率与复盘速度评估"
      })
      .expect(200);

    expect(updatedDimension.body.name).toBe("效率改进");

    await request(app.getHttpServer())
      .delete(`/performance/dimensions/${createdDimension.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/performance/cycles/${createdCycle.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("should reject dimension update when total weight exceeds 100", async () => {
    const createdCycle = await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "2026Q8 权重编辑边界",
        startDate: "2026-10-01",
        endDate: "2026-12-31",
        status: "DRAFT"
      })
      .expect(201);

    const first = await request(app.getHttpServer())
      .post(`/performance/cycles/${createdCycle.body.id}/dimensions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "delivery",
        name: "交付",
        weight: 50,
        metricHint: "按交付"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${createdCycle.body.id}/dimensions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "support",
        name: "支持",
        weight: 40,
        metricHint: "按支持"
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/performance/dimensions/${first.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ weight: 70 })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/performance/cycles/${createdCycle.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("should reject dimension metric hint longer than 200 characters", async () => {
    const createdCycle = await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "2026Q9 说明长度",
        startDate: "2026-11-01",
        endDate: "2026-12-31",
        status: "DRAFT"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${createdCycle.body.id}/dimensions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "metricHintTooLong",
        name: "说明测试",
        weight: 10,
        metricHint: "说明".repeat(101)
      })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/performance/cycles/${createdCycle.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("employee role cannot mutate performance config", async () => {
    const unique = Date.now();
    const username = `perf_editor_${unique}`;

    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username, realName: "Performance Editor" })
      .expect(201);

    const employeeLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username, password: "123456" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/performance/cycles")
      .set("Authorization", `Bearer ${employeeLogin.body.accessToken}`)
      .send({
        name: "forbidden",
        startDate: "2026-10-01",
        endDate: "2026-12-31"
      })
      .expect(403);
  });
});
