import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Feedback (e2e)", () => {
  let app: INestApplication;
  let adminToken = "";

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
    adminToken = login.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  it("employee can view feedback list and review timeline", async () => {
    const suffix = Date.now().toString();
    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: `staff_fb_${suffix}`, realName: "Staff Feedback" })
      .expect(201);

    const employeeLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: `staff_fb_${suffix}`, password: "123456" })
      .expect(201);
    const employeeToken = employeeLogin.body.accessToken as string;

    const report = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        cycleId: 8,
        thisWeekText: "完成反馈页开发",
        nextWeekText: "补充时间线",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${report.body.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "REJECTED", comment: "请补充风险细节" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/weekly-reports/${report.body.id}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ action: "resubmit" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${report.body.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "APPROVED", comment: "补充完整，已通过" })
      .expect(201);

    const feedback = await request(app.getHttpServer())
      .get("/weekly-reports/mine/feedback")
      .set("Authorization", `Bearer ${employeeToken}`)
      .expect(200);

    expect(
      feedback.body.items.some(
        (item: { reportId: number; latestComment: string }) =>
          item.reportId === report.body.id &&
          item.latestComment.includes("通过")
      )
    ).toBe(true);

    const timeline = await request(app.getHttpServer())
      .get(`/weekly-reports/${report.body.id}/timeline`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .expect(200);

    expect(timeline.body.items.length).toBe(2);
    expect(timeline.body.items[0].decision).toBe("REJECTED");
    expect(timeline.body.items[1].decision).toBe("APPROVED");
  });
});
