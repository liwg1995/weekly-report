import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Review Nudges (e2e)", () => {
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

  it("can create nudge task and list recent tasks", async () => {
    const created = await request(app.getHttpServer())
      .post("/weekly-reports/review-nudges")
      .set("Authorization", `Bearer ${token}`)
      .send({ level: "SLA24", targetReportIds: [1, 2, 2] })
      .expect(201);

    expect(created.body.level).toBe("SLA24");
    expect(created.body.targetCount).toBe(2);
    expect(created.body.status).toBe("PENDING");

    const list = await request(app.getHttpServer())
      .get("/weekly-reports/review-nudges?limit=5")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const target = list.body.items.find((item: { id: number }) => item.id === created.body.id);
    expect(target).toBeTruthy();
    expect(target.level).toBe("SLA24");
    expect(target.status).toBe("PENDING");
  });

  it("can update nudge task status", async () => {
    const created = await request(app.getHttpServer())
      .post("/weekly-reports/review-nudges")
      .set("Authorization", `Bearer ${token}`)
      .send({ level: "SLA48", targetReportIds: [] })
      .expect(201);

    const markFailed = await request(app.getHttpServer())
      .patch(`/weekly-reports/review-nudges/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "markFailed" })
      .expect(200);
    expect(markFailed.body.status).toBe("FAILED");

    const retry = await request(app.getHttpServer())
      .patch(`/weekly-reports/review-nudges/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "retry" })
      .expect(200);
    expect(retry.body.status).toBe("PENDING");
  });
});
