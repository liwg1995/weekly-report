import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Reviews (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let token = "";

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = new PrismaClient();

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "admin", password: "123456" })
      .expect(201);
    token = login.body.accessToken;
  });

  afterEach(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it("manager can approve report with suggestion", async () => {
    const report = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 2,
        thisWeekText: "完成用户管理",
        nextWeekText: "开发审批流",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    const review = await request(app.getHttpServer())
      .post(`/weekly-reports/${report.body.id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "APPROVED", comment: "结构清晰，继续保持" })
      .expect(201);

    expect(review.body.decision).toBe("APPROVED");
  });

  it("manager can reject report with suggestion and employee can resubmit", async () => {
    const report = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 3,
        thisWeekText: "完成初稿",
        nextWeekText: "补充细节",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${report.body.id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "REJECTED", comment: "请补充风险说明" })
      .expect(201);

    const resubmit = await request(app.getHttpServer())
      .patch(`/weekly-reports/${report.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "resubmit" })
      .expect(200);

    expect(resubmit.body.status).toBe("PENDING_APPROVAL");
  });

  it("employee cannot review report", async () => {
    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: "alice", realName: "Alice" })
      .expect(201);

    const employeeLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "alice", password: "123456" })
      .expect(201);

    const report = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 4,
        thisWeekText: "完成接口联调",
        nextWeekText: "补充测试",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${report.body.id}/review`)
      .set("Authorization", `Bearer ${employeeLogin.body.accessToken}`)
      .send({ decision: "APPROVED", comment: "我来审批" })
      .expect(403);
  });

  it("manager can review direct report but cannot review non-team member", async () => {
    const suffix = Date.now().toString();

    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `mgr_${suffix}`, realName: "Manager" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `emp_${suffix}`, realName: "Employee" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `other_${suffix}`, realName: "Other Employee" })
      .expect(201);

    const manager = await prisma.user.findUniqueOrThrow({
      where: { username: `mgr_${suffix}` }
    });
    const employee = await prisma.user.findUniqueOrThrow({
      where: { username: `emp_${suffix}` }
    });
    const other = await prisma.user.findUniqueOrThrow({
      where: { username: `other_${suffix}` }
    });

    const dept = await prisma.department.create({
      data: { name: `Dept-${suffix}`, managerUserId: manager.id }
    });
    const otherDept = await prisma.department.create({
      data: { name: `OtherDept-${suffix}` }
    });
    await prisma.userDepartment.createMany({
      data: [
        { userId: employee.id, departmentId: dept.id, roleInDept: "member" },
        { userId: other.id, departmentId: otherDept.id, roleInDept: "member" }
      ],
      skipDuplicates: true
    });

    const managerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: `mgr_${suffix}`, password: "123456" })
      .expect(201);

    const teamReport = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${await loginAs(`emp_${suffix}`)}`)
      .send({
        cycleId: 5,
        thisWeekText: "team work",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${teamReport.body.id}/review`)
      .set("Authorization", `Bearer ${managerLogin.body.accessToken}`)
      .send({ decision: "APPROVED", comment: "直属下属通过" })
      .expect(201);

    const otherReport = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${await loginAs(`other_${suffix}`)}`)
      .send({
        cycleId: 6,
        thisWeekText: "other work",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${otherReport.body.id}/review`)
      .set("Authorization", `Bearer ${managerLogin.body.accessToken}`)
      .send({ decision: "APPROVED", comment: "非直属" })
      .expect(403);
  });

  it("dept admin can review report in the same department", async () => {
    const suffix = (Date.now() + 1).toString();
    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `dept_admin_${suffix}`, realName: "Dept Admin" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `staff_${suffix}`, realName: "Staff" })
      .expect(201);

    const deptAdmin = await prisma.user.findUniqueOrThrow({
      where: { username: `dept_admin_${suffix}` }
    });
    const staff = await prisma.user.findUniqueOrThrow({
      where: { username: `staff_${suffix}` }
    });
    const dept = await prisma.department.create({
      data: { name: `DeptAdmin-${suffix}` }
    });

    await prisma.userDepartment.createMany({
      data: [
        {
          userId: deptAdmin.id,
          departmentId: dept.id,
          roleInDept: "admin",
          isPrimary: true
        },
        {
          userId: staff.id,
          departmentId: dept.id,
          roleInDept: "member",
          isPrimary: true
        }
      ],
      skipDuplicates: true
    });

    const deptAdminToken = await loginAs(`dept_admin_${suffix}`);
    const staffToken = await loginAs(`staff_${suffix}`);

    const report = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        cycleId: 7,
        thisWeekText: "same dept",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${report.body.id}/review`)
      .set("Authorization", `Bearer ${deptAdminToken}`)
      .send({ decision: "APPROVED", comment: "部门管理员审批" })
      .expect(201);
  });

  async function loginAs(username: string) {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username, password: "123456" })
      .expect(201);
    return login.body.accessToken as string;
  }
});
