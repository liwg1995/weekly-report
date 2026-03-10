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
        needsHelpText: "",
        mentionLeader: true,
        mentionComment: "@leader 请优先查阅"
      })
      .expect(201);

    expect(res.body.status).toBe("PENDING_APPROVAL");
    expect(res.body.mentionLeader).toBe(true);
    expect(res.body.mentionComment).toBe("@leader 请优先查阅");
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

  it("leader can only list and review direct reports", async () => {
    const suffix = Date.now().toString();
    const leader = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `leader_${suffix}`, realName: "Leader" })
      .expect(201);
    const member = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `member_${suffix}`, realName: "Member" })
      .expect(201);
    const outsider = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `outsider_${suffix}`, realName: "Outsider" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/users/${member.body.id}/leader`)
      .set("Authorization", `Bearer ${token}`)
      .send({ leaderUserId: leader.body.id })
      .expect(200);

    const leaderLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: `leader_${suffix}`, password: "123456" })
      .expect(201);
    expect(leaderLogin.body.user.roles).toContain("LEADER");

    const memberLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: `member_${suffix}`, password: "123456" })
      .expect(201);
    const outsiderLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: `outsider_${suffix}`, password: "123456" })
      .expect(201);

    const memberReport = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${memberLogin.body.accessToken}`)
      .send({
        cycleId: 8,
        thisWeekText: "member report",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    const outsiderReport = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${outsiderLogin.body.accessToken}`)
      .send({
        cycleId: 9,
        thisWeekText: "outsider report",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get("/weekly-reports?status=PENDING_APPROVAL&page=1&pageSize=10")
      .set("Authorization", `Bearer ${leaderLogin.body.accessToken}`)
      .expect(200);

    const ids = list.body.items.map((item: { id: number }) => item.id);
    expect(ids).toContain(memberReport.body.id);
    expect(ids).not.toContain(outsiderReport.body.id);
    expect(list.body.page).toBe(1);
    expect(list.body.pageSize).toBe(10);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${memberReport.body.id}/review`)
      .set("Authorization", `Bearer ${leaderLogin.body.accessToken}`)
      .send({ decision: "APPROVED", comment: "直属主管通过" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${outsiderReport.body.id}/review`)
      .set("Authorization", `Bearer ${leaderLogin.body.accessToken}`)
      .send({ decision: "APPROVED", comment: "非直属不应通过" })
      .expect(403);
  });

  it("can filter pending list by department and leader", async () => {
    const suffix = `${Date.now()}_f`;
    const leader = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `leader_filter_${suffix}`, realName: "Leader Filter" })
      .expect(201);
    const empA = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `empA_${suffix}`, realName: "Emp A" })
      .expect(201);
    const empB = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `empB_${suffix}`, realName: "Emp B" })
      .expect(201);
    const dept = await request(app.getHttpServer())
      .post("/departments")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `FilterDept-${suffix}`, reportDueWeekday: 5 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/users/${empA.body.id}/leader`)
      .set("Authorization", `Bearer ${token}`)
      .send({ leaderUserId: leader.body.id })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/users/${empA.body.id}/departments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ departmentId: dept.body.id, roleInDept: "member", isPrimary: true })
      .expect(201);

    const empAToken = (
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ username: `empA_${suffix}`, password: "123456" })
        .expect(201)
    ).body.accessToken as string;
    const empBToken = (
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ username: `empB_${suffix}`, password: "123456" })
        .expect(201)
    ).body.accessToken as string;

    const reportA = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({
        cycleId: 10,
        thisWeekText: "department match",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);
    const reportB = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${empBToken}`)
      .send({
        cycleId: 11,
        thisWeekText: "department miss",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    const byDept = await request(app.getHttpServer())
      .get(`/weekly-reports?status=PENDING_APPROVAL&departmentId=${dept.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const deptIds = byDept.body.items.map((item: { id: number }) => item.id);
    expect(deptIds).toContain(reportA.body.id);
    expect(deptIds).not.toContain(reportB.body.id);

    const byLeader = await request(app.getHttpServer())
      .get(`/weekly-reports?status=PENDING_APPROVAL&leaderUserId=${leader.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const leaderIds = byLeader.body.items.map((item: { id: number }) => item.id);
    expect(leaderIds).toContain(reportA.body.id);
    expect(leaderIds).not.toContain(reportB.body.id);
  });

  it("can filter pending list by mentionLeader flag", async () => {
    const withMention = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 12,
        thisWeekText: "with mention",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: "",
        mentionLeader: true,
        mentionComment: "请直属主管优先看"
      })
      .expect(201);
    const withoutMention = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 13,
        thisWeekText: "without mention",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: ""
      })
      .expect(201);

    const mentionOnly = await request(app.getHttpServer())
      .get("/weekly-reports?status=PENDING_APPROVAL&mentionLeaderOnly=true")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const ids = mentionOnly.body.items.map((item: { id: number }) => item.id);
    expect(ids).toContain(withMention.body.id);
    expect(ids).not.toContain(withoutMention.body.id);
  });

  it("returns mention fields in mine feedback list", async () => {
    const created = await request(app.getHttpServer())
      .post("/weekly-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cycleId: 14,
        thisWeekText: "feedback mention",
        nextWeekText: "next",
        risksText: "",
        needsHelpText: "",
        mentionLeader: true,
        mentionComment: "@leader 需要查阅"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/weekly-reports/${created.body.id}/review`)
      .set("Authorization", `Bearer ${token}`)
      .send({ decision: "APPROVED", comment: "已阅" })
      .expect(201);

    const mine = await request(app.getHttpServer())
      .get("/weekly-reports/mine/feedback")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const target = mine.body.items.find((item: { reportId: number }) => item.reportId === created.body.id);
    expect(target).toBeTruthy();
    expect(target.mentionLeader).toBe(true);
    expect(target.mentionComment).toBe("@leader 需要查阅");
    expect(typeof target.submittedAt).toBe("string");
  });
});
