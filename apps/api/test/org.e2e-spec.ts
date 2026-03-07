import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Org (e2e)", () => {
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

  it("admin can create department with due weekday", async () => {
    const res = await request(app.getHttpServer())
      .post("/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "R&D", reportDueWeekday: 5 })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("R&D");
  });

  it("admin can create and list users", async () => {
    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "alice", realName: "Alice" })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.items.some((x: { username: string }) => x.username === "alice")).toBe(true);
  });

  it("admin can create import job by uploading metadata", async () => {
    const res = await request(app.getHttpServer())
      .post("/imports/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ fileName: "employees.xlsx" })
      .expect(201);

    expect(res.body.status).toBe("PENDING");
  });
});
