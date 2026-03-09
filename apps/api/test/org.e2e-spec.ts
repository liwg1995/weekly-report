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
    const alice = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "alice", realName: "Alice" })
      .expect(201);
    const bob = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "bob", realName: "Bob Leader" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/users/${alice.body.id}/leader`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ leaderUserId: bob.body.id })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get("/users?keyword=alice")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.items.some((x: { username: string }) => x.username === "alice")).toBe(true);
    const aliceItem = list.body.items.find((x: { username: string }) => x.username === "alice");
    expect(aliceItem.leader.username).toBe("bob");
  });

  it("admin can assign user to department and query with pagination", async () => {
    const dept = await request(app.getHttpServer())
      .post("/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "产品部", reportDueWeekday: 4 })
      .expect(201);
    const user = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "cathy", realName: "Cathy" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/users/${user.body.id}/departments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        departmentId: dept.body.id,
        roleInDept: "admin",
        isPrimary: true
      })
      .expect(201);

    const users = await request(app.getHttpServer())
      .get(`/users?page=1&pageSize=10&departmentId=${dept.body.id}&keyword=cat`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(users.body.page).toBe(1);
    expect(users.body.pageSize).toBe(10);
    expect(users.body.total).toBeGreaterThanOrEqual(1);
    expect(users.body.items.some((x: { username: string }) => x.username === "cathy")).toBe(true);
  });

  it("admin can update department parent and manager", async () => {
    const parent = await request(app.getHttpServer())
      .post("/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "总部", reportDueWeekday: 5 })
      .expect(201);
    const child = await request(app.getHttpServer())
      .post("/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "研发一部", reportDueWeekday: 5 })
      .expect(201);
    const leader = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "deptleader", realName: "Dept Leader" })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/departments/${child.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ parentId: parent.body.id, managerUserId: leader.body.id, reportDueWeekday: 3 })
      .expect(200);

    expect(updated.body.parentId).toBe(parent.body.id);
    expect(updated.body.managerUserId).toBe(leader.body.id);
    expect(updated.body.reportDueWeekday).toBe(3);
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
