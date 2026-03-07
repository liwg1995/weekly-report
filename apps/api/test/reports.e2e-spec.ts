import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Reports (e2e)", () => {
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

  it("can submit weekly report and status becomes pending approval", async () => {
    const res = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 1,
        thisWeekText: "完成登录和组织管理",
        nextWeekText: "开始审批流开发",
        risksText: "暂无",
        needsHelpText: ""
      })
      .expect(201);

    expect(res.body.status).toBe("PENDING_APPROVAL");
  });

  it("can resubmit report after rejected", async () => {
    const create = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 1,
        thisWeekText: "初稿",
        nextWeekText: "补充说明",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${create.body.id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "REJECTED", comment: "请补充周风险" })
      .expect(201);

    const resubmit = await request(app.getHttpServer())
      .patch(`/weekly-reports/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "resubmit" })
      .expect(200);

    expect(resubmit.body.status).toBe("PENDING_APPROVAL");
  });

  it("can list reports by status", async () => {
    await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 1,
        thisWeekText: "done",
        nextWeekText: "plan",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get("/weekly-reports?status=PENDING_APPROVAL")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(list.body.items.length).toBeGreaterThan(0);
  });
});
