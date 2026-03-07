import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Notifications (e2e)", () => {
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

  it("returns notification channel switches for manager roles", async () => {
    const result = await request(app.getHttpServer())
      .get("/notifications/channels")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(result.body).toMatchObject({
      wecom: {
        enabled: false
      },
      dingtalk: {
        enabled: false
      }
    });
    expect(typeof result.body.wecom.webhookConfigured).toBe("boolean");
    expect(typeof result.body.dingtalk.webhookConfigured).toBe("boolean");
  });
});

