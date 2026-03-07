import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Audit (e2e)", () => {
  let app: INestApplication;
  let token = "";

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "admin", password: "123456" })
      .expect(201);
    token = login.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns persisted review audit logs", async () => {
    const report = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 99,
        thisWeekText: "审计日志测试",
        nextWeekText: "继续测试",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${report.body.id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "APPROVED", comment: "审计通过" })
      .expect(201);

    const logs = await request(app.getHttpServer())
      .get("/audit-logs/reviews?limit=5")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(
      logs.body.items.some(
        (item: { action: string; targetId: string; actor?: { username: string } }) =>
          item.action === "REVIEW_APPROVED" &&
          item.targetId === String(report.body.id) &&
          item.actor?.username === "admin"
      )
    ).toBe(true);
  });

  it("supports filtering review audit logs by decision", async () => {
    const reportApproved = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 99,
        thisWeekText: "审批日志过滤-通过",
        nextWeekText: "继续测试",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    const reportRejected = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 99,
        thisWeekText: "审批日志过滤-驳回",
        nextWeekText: "继续测试",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${reportApproved.body.id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "APPROVED", comment: "通过" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${reportRejected.body.id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "REJECTED", comment: "驳回" })
      .expect(201);

    const approvedOnly = await request(app.getHttpServer())
      .get("/audit-logs/reviews?limit=10&decision=APPROVED")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(approvedOnly.body.items.length).toBeGreaterThan(0);
    expect(
      approvedOnly.body.items.every(
        (item: { action: string }) => item.action === "REVIEW_APPROVED"
      )
    ).toBe(true);
  });

  it("persists review export templates for current user", async () => {
    const sync = await request(app.getHttpServer())
      .post("/audit-logs/review-templates/sync")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          {
            id: "tpl-e2e-1",
            name: "周报复盘模板",
            createdAt: "2026-03-20T08:00:00.000Z",
            pinned: true,
            diffExportMaskSensitive: false,
            filters: {
              decision: "APPROVED",
              actorKeyword: "admin",
              dateFrom: "2026-03-01",
              dateTo: "2026-03-20"
            },
            columns: {
              time: true,
              actor: true,
              action: true,
              targetId: true
            },
            encoding: "gbk"
          }
        ]
      })
      .expect(201);

    expect(sync.body.items).toHaveLength(1);
    expect(sync.body.items[0]).toMatchObject({
      id: "tpl-e2e-1",
      name: "周报复盘模板",
      pinned: true,
      encoding: "gbk",
      diffExportMaskSensitive: false
    });

    const listed = await request(app.getHttpServer())
      .get("/audit-logs/review-templates")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0]).toMatchObject({
      id: "tpl-e2e-1",
      name: "周报复盘模板",
      pinned: true,
      filters: {
        decision: "APPROVED",
        actorKeyword: "admin"
      },
      columns: {
        time: true,
        actor: true,
        action: true,
        targetId: true
      },
      encoding: "gbk",
      diffExportMaskSensitive: false
    });
  });

  it("supports template version history and rollback", async () => {
    await request(app.getHttpServer())
      .post("/audit-logs/review-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        item: {
          id: "tpl-version-e2e",
          name: "版本模板V1",
          createdAt: "2026-03-20T08:00:00.000Z",
          pinned: false,
          diffExportMaskSensitive: false,
          filters: {
            decision: "APPROVED",
            actorKeyword: "",
            dateFrom: "",
            dateTo: ""
          },
          columns: {
            time: true,
            actor: true,
            action: true,
            targetId: true
          },
          encoding: "utf-8"
        }
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch("/audit-logs/review-templates/tpl-version-e2e")
      .set("Authorization", `Bearer ${token}`)
      .send({
        item: {
          name: "版本模板V2",
          createdAt: "2026-03-20T09:00:00.000Z",
          diffExportMaskSensitive: true
        }
      })
      .expect(200);

    const versions = await request(app.getHttpServer())
      .get("/audit-logs/review-templates/tpl-version-e2e/versions")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(versions.body.items.length).toBeGreaterThanOrEqual(2);
    const rollbackTarget = versions.body.items[versions.body.items.length - 1] as {
      id: number;
      name: string;
      diffExportMaskSensitive: boolean;
    };
    expect(rollbackTarget.name).toBe("版本模板V1");
    expect(rollbackTarget.diffExportMaskSensitive).toBe(false);

    await request(app.getHttpServer())
      .post("/audit-logs/review-templates/tpl-version-e2e/rollback")
      .set("Authorization", `Bearer ${token}`)
      .send({ versionId: rollbackTarget.id })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get("/audit-logs/review-templates")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(
      listed.body.items.find((item: { id: string }) => item.id === "tpl-version-e2e")
    ).toMatchObject({
      name: "版本模板V1",
      diffExportMaskSensitive: false
    });
  });

  it("super admin can manage templates for specified ownerUserId", async () => {
    const unique = Date.now();
    const createdUser = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        username: `audit-user-${unique}`,
        realName: `审计用户${unique}`
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/audit-logs/review-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ownerUserId: createdUser.body.id,
        item: {
          id: `tpl-owner-${unique}`,
          name: "跨用户模板",
          createdAt: "2026-03-20T08:00:00.000Z",
          pinned: false,
          diffExportMaskSensitive: false,
          filters: {
            decision: "all",
            actorKeyword: "",
            dateFrom: "",
            dateTo: ""
          },
          columns: {
            time: true,
            actor: true,
            action: true,
            targetId: true
          },
          encoding: "utf-8"
        }
      })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get(`/audit-logs/review-templates?ownerUserId=${createdUser.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0]).toMatchObject({
      id: `tpl-owner-${unique}`,
      name: "跨用户模板",
      diffExportMaskSensitive: false
    });
  });

  it("covers end-to-end flow: login, submit, review, template config and version rollback", async () => {
    const report = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 99,
        thisWeekText: "全链路测试-本周工作",
        nextWeekText: "全链路测试-下周计划",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${report.body.id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "APPROVED", comment: "全链路审批通过" })
      .expect(201);

    const auditLogs = await request(app.getHttpServer())
      .get("/audit-logs/reviews?limit=10&decision=APPROVED")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(
      auditLogs.body.items.some(
        (item: { targetId: string; action: string }) =>
          item.targetId === String(report.body.id) && item.action === "REVIEW_APPROVED"
      )
    ).toBe(true);

    await request(app.getHttpServer())
      .post("/audit-logs/review-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        item: {
          id: "tpl-e2e-flow",
          name: "全链路模板V1",
          createdAt: "2026-03-20T08:00:00.000Z",
          pinned: false,
          diffExportMaskSensitive: true,
          filters: {
            decision: "APPROVED",
            actorKeyword: "admin",
            dateFrom: "",
            dateTo: ""
          },
          columns: {
            time: true,
            actor: true,
            action: true,
            targetId: true
          },
          encoding: "utf-8"
        }
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch("/audit-logs/review-templates/tpl-e2e-flow")
      .set("Authorization", `Bearer ${token}`)
      .send({
        item: {
          name: "全链路模板V2",
          diffExportMaskSensitive: false
        }
      })
      .expect(200);

    const versions = await request(app.getHttpServer())
      .get("/audit-logs/review-templates/tpl-e2e-flow/versions")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(versions.body.items.length).toBeGreaterThanOrEqual(2);
    const oldest = versions.body.items[versions.body.items.length - 1] as {
      id: number;
      name: string;
      diffExportMaskSensitive: boolean;
    };
    expect(oldest).toMatchObject({
      name: "全链路模板V1",
      diffExportMaskSensitive: true
    });

    await request(app.getHttpServer())
      .post("/audit-logs/review-templates/tpl-e2e-flow/rollback")
      .set("Authorization", `Bearer ${token}`)
      .send({ versionId: oldest.id })
      .expect(201);

    const templates = await request(app.getHttpServer())
      .get("/audit-logs/review-templates")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(
      templates.body.items.find((item: { id: string }) => item.id === "tpl-e2e-flow")
    ).toMatchObject({
      name: "全链路模板V1",
      diffExportMaskSensitive: true
    });
  });
});
