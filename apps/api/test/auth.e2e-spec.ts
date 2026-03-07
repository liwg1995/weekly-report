import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Auth (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("POST /auth/login returns token for valid credentials", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "admin", password: "123456" })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
  });

  it("GET /auth/me returns current user when token is valid", async () => {
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "admin", password: "123456" })
      .expect(201);

    const meRes = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`)
      .expect(200);

    expect(meRes.body.username).toBe("admin");
  });
});
