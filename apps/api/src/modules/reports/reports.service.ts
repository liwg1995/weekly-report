import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CycleStatus, Prisma, ReportStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../auth/auth.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureCanManageReviews(user: AuthUser) {
    const allowed = user.roles.some((role) =>
      ["SUPER_ADMIN", "DEPT_ADMIN", "MANAGER", "LEADER"].includes(role)
    );
    if (!allowed) {
      throw new ForbiddenException("你当前没有审批权限，请联系管理员分配角色。");
    }
  }

  private async buildRoleWheres(user: AuthUser): Promise<Prisma.WeeklyReportWhereInput[]> {
    const roleWheres: Prisma.WeeklyReportWhereInput[] = [];
    if (user.roles.includes("SUPER_ADMIN")) {
      roleWheres.push({});
    }

    if (user.roles.includes("MANAGER")) {
      const managedDepts = await this.prisma.department.findMany({
        where: { managerUserId: user.id },
        select: { id: true }
      });
      const deptIds = managedDepts.map((item) => item.id);
      if (deptIds.length > 0) {
        roleWheres.push({
          user: {
            userDepartments: {
              some: {
                departmentId: { in: deptIds }
              }
            }
          }
        });
      }
    }

    if (user.roles.includes("DEPT_ADMIN")) {
      const adminDepts = await this.prisma.userDepartment.findMany({
        where: {
          userId: user.id,
          roleInDept: "admin"
        },
        select: { departmentId: true }
      });
      const deptIds = adminDepts.map((item) => item.departmentId);
      if (deptIds.length > 0) {
        roleWheres.push({
          user: {
            userDepartments: {
              some: {
                departmentId: { in: deptIds }
              }
            }
          }
        });
      }
    }

    if (user.roles.includes("LEADER")) {
      roleWheres.push({
        user: { leaderUserId: user.id }
      });
    }

    if (user.roles.includes("EMPLOYEE")) {
      roleWheres.push({ userId: user.id });
    }
    return roleWheres;
  }

  private async ensureCycle(cycleId: number) {
    const existing = await this.prisma.reportCycle.findUnique({
      where: { id: cycleId }
    });
    if (existing) {
      return existing;
    }

    const department = await this.prisma.department.findFirst({
      orderBy: { id: "asc" }
    });
    const dept =
      department ??
      (await this.prisma.department.create({
        data: { name: "Default Department", reportDueWeekday: 5 }
      }));

    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 6);

    return this.prisma.reportCycle.create({
      data: {
        id: cycleId,
        departmentId: dept.id,
        weekStart: now,
        weekEnd,
        dueAt: weekEnd,
        status: CycleStatus.OPEN
      }
    });
  }

  async create(
    userId: number,
    input: {
      cycleId: number;
      thisWeekText: string;
      nextWeekText: string;
      risksText: string;
      needsHelpText: string;
      mentionLeader?: boolean;
      mentionComment?: string;
    }
  ) {
    await this.ensureCycle(input.cycleId);
    return this.prisma.weeklyReport.create({
      data: {
        cycleId: input.cycleId,
        userId,
        status: ReportStatus.PENDING_APPROVAL,
        thisWeekText: input.thisWeekText,
        nextWeekText: input.nextWeekText,
        risksText: input.risksText,
        needsHelpText: input.needsHelpText,
        mentionLeader: Boolean(input.mentionLeader),
        mentionComment: input.mentionComment?.trim() ?? "",
        submittedAt: new Date()
      }
    });
  }

  async update(
    id: number,
    action: "resubmit" | "markRejected",
    userId: number
  ) {
    const report = await this.prisma.weeklyReport.findFirst({
      where: { id, userId }
    });
    if (!report) {
      throw new NotFoundException("周报不存在");
    }

    if (action === "markRejected") {
      return this.prisma.weeklyReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.REJECTED,
          rejectedAt: new Date()
        }
      });
    }

    if (action === "resubmit" && report.status === ReportStatus.REJECTED) {
      return this.prisma.weeklyReport.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.PENDING_APPROVAL,
          submittedAt: new Date()
        }
      });
    }

    return report;
  }

  async list(
    user: AuthUser,
    query?: {
      status?: string;
      page?: number;
      pageSize?: number;
      keyword?: string;
      departmentId?: number;
      leaderUserId?: number;
      overdueFirst?: boolean;
      mentionLeaderOnly?: boolean;
      mentionFirst?: boolean;
      myDirectOnly?: boolean;
    }
  ) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 20));
    const keyword = query?.keyword?.trim();
    const status = query?.status;
    const roleWheres = await this.buildRoleWheres(user);

    const where: Prisma.WeeklyReportWhereInput = {
      ...(status ? { status: status as ReportStatus } : {}),
      ...(query?.departmentId
        ? {
            user: {
              userDepartments: {
                some: { departmentId: query.departmentId }
              }
            }
          }
        : {}),
      ...(query?.leaderUserId
        ? {
            user: {
              leaderUserId: query.leaderUserId
            }
          }
        : {}),
      ...(query?.mentionLeaderOnly
        ? {
            mentionLeader: true
          }
        : {}),
      ...(query?.myDirectOnly
        ? {
            user: {
              leaderUserId: user.id
            }
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              { thisWeekText: { contains: keyword } },
              { nextWeekText: { contains: keyword } },
              { risksText: { contains: keyword } },
              { needsHelpText: { contains: keyword } },
              { user: { username: { contains: keyword } } },
              { user: { realName: { contains: keyword } } }
            ]
          }
        : {}),
      ...(roleWheres.length > 0 ? { AND: [{ OR: roleWheres }] } : {})
    };

    const orderBy: Prisma.WeeklyReportOrderByWithRelationInput[] = [];
    if (query?.mentionFirst) {
      orderBy.push({ mentionLeader: "desc" });
    }
    if (query?.overdueFirst) {
      orderBy.push({ cycle: { dueAt: "asc" } });
    }
    orderBy.push({ id: "desc" });

    const [total, items] = await this.prisma.$transaction([
      this.prisma.weeklyReport.count({ where }),
      this.prisma.weeklyReport.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          cycle: {
            select: {
              dueAt: true
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              realName: true,
              leaderUserId: true,
              leader: {
                select: {
                  id: true,
                  username: true,
                  realName: true
                }
              }
            }
          }
        }
      })
    ]);

    const nowTs = Date.now();
    return {
      items: items.map((item) => ({
        ...item,
        isOverdue:
          item.status === ReportStatus.PENDING_APPROVAL &&
          item.cycle.dueAt.getTime() < nowTs
      })),
      total,
      page,
      pageSize
    };
  }

  async filterOptions(user: AuthUser, status?: string) {
    const roleWheres = await this.buildRoleWheres(user);
    const scopedReports = await this.prisma.weeklyReport.findMany({
      where: {
        ...(status ? { status: status as ReportStatus } : {}),
        ...(roleWheres.length > 0 ? { AND: [{ OR: roleWheres }] } : {})
      },
      select: {
        user: {
          select: {
            leader: {
              select: { id: true, username: true, realName: true }
            },
            userDepartments: {
              select: {
                department: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      },
      take: 1000
    });

    const leaderMap = new Map<number, { id: number; username: string; realName: string }>();
    const deptMap = new Map<number, { id: number; name: string }>();
    for (const report of scopedReports) {
      if (report.user.leader) {
        leaderMap.set(report.user.leader.id, report.user.leader);
      }
      for (const rel of report.user.userDepartments) {
        deptMap.set(rel.department.id, rel.department);
      }
    }

    return {
      leaders: [...leaderMap.values()].sort((a, b) =>
        `${a.realName}${a.username}`.localeCompare(`${b.realName}${b.username}`, "zh-CN")
      ),
      departments: [...deptMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "zh-CN")
      )
    };
  }

  async myFeedback(userId: number) {
    const reports = await this.prisma.weeklyReport.findMany({
      where: { userId },
      orderBy: { id: "desc" },
      include: {
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    return {
      items: reports
        .filter((report) => report.reviews.length > 0)
        .map((report) => {
          const latest = report.reviews[0];
          return {
            reportId: report.id,
            status: report.status,
            thisWeekText: report.thisWeekText,
            submittedAt: report.submittedAt,
            mentionLeader: report.mentionLeader,
            mentionComment: report.mentionComment,
            latestDecision: latest.decision,
            latestComment: latest.comment,
            latestReviewedAt: latest.createdAt
          };
        })
    };
  }

  async reviewTimeline(reportId: number, user: AuthUser) {
    const report = await this.prisma.weeklyReport.findUnique({
      where: { id: reportId }
    });
    if (!report) {
      throw new NotFoundException("周报不存在");
    }

    const canView =
      report.userId === user.id ||
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("MANAGER") ||
      user.roles.includes("DEPT_ADMIN");
    if (!canView) {
      throw new NotFoundException("周报不存在");
    }

    const items = await this.prisma.reportReview.findMany({
      where: { reportId },
      orderBy: { createdAt: "asc" },
      include: {
        reviewer: {
          select: { id: true, username: true, realName: true }
        }
      }
    });

    return {
      reportId,
      items: items.map((item) => ({
        id: item.id,
        decision: item.decision,
        comment: item.comment,
        createdAt: item.createdAt,
        reviewer: item.reviewer
      }))
    };
  }

  async createReviewNudgeTask(
    user: AuthUser,
    input: {
      level: "SLA24" | "SLA48";
      targetReportIds?: number[];
    }
  ) {
    this.ensureCanManageReviews(user);
    const level = input.level;
    if (!["SLA24", "SLA48"].includes(level)) {
      throw new BadRequestException("不支持的催办级别");
    }
    const normalizedIds = [...new Set((input.targetReportIds ?? []).filter((id) => Number.isInteger(id) && id > 0))]
      .slice(0, 200);
    const message =
      level === "SLA48"
        ? `超48h未处理催办任务，涉及 ${normalizedIds.length} 条周报`
        : `超24h未处理催办任务，涉及 ${normalizedIds.length} 条周报`;

    const created = await this.prisma.reviewNudgeTask.create({
      data: {
        creatorUserId: user.id,
        level,
        status: "PENDING",
        channel: "LOCAL_PLACEHOLDER",
        message,
        targetCount: normalizedIds.length,
        targetIdsJson: normalizedIds
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "REVIEW_NUDGE_CREATED",
        targetType: "review_nudge_task",
        targetId: String(created.id),
        afterJson: {
          level: created.level,
          targetCount: created.targetCount,
          channel: created.channel,
          status: created.status
        }
      }
    });

    return {
      id: created.id,
      level: created.level,
      status: created.status,
      channel: created.channel,
      targetCount: created.targetCount,
      message: created.message,
      createdAt: created.createdAt
    };
  }

  async listReviewNudgeTasks(
    user: AuthUser,
    query?: { limit?: number; page?: number; pageSize?: number; status?: string; level?: string }
  ) {
    this.ensureCanManageReviews(user);
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(20, Math.max(1, query?.pageSize ?? query?.limit ?? 5));
    const where: Prisma.ReviewNudgeTaskWhereInput = {
      creatorUserId: user.id,
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.level ? { level: query.level } : {})
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.reviewNudgeTask.count({ where }),
      this.prisma.reviewNudgeTask.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    return {
      total,
      page,
      pageSize,
      items: items.map((item) => ({
        id: item.id,
        level: item.level,
        status: item.status,
        channel: item.channel,
        targetCount: item.targetCount,
        message: item.message,
        createdAt: item.createdAt
      }))
    };
  }

  async updateReviewNudgeTask(
    user: AuthUser,
    id: number,
    action: "markSent" | "markFailed" | "retry"
  ) {
    this.ensureCanManageReviews(user);
    const task = await this.prisma.reviewNudgeTask.findFirst({
      where: {
        id,
        creatorUserId: user.id
      }
    });
    if (!task) {
      throw new NotFoundException("催办任务不存在");
    }

    const nextStatus =
      action === "markSent" ? "SENT" : action === "markFailed" ? "FAILED" : "PENDING";
    const updated = await this.prisma.reviewNudgeTask.update({
      where: { id: task.id },
      data: { status: nextStatus }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "REVIEW_NUDGE_UPDATED",
        targetType: "review_nudge_task",
        targetId: String(updated.id),
        beforeJson: { status: task.status },
        afterJson: { status: updated.status, action }
      }
    });

    return {
      id: updated.id,
      level: updated.level,
      status: updated.status,
      channel: updated.channel,
      targetCount: updated.targetCount,
      message: updated.message,
      createdAt: updated.createdAt
    };
  }

  async retryReviewNudgeTasks(user: AuthUser, ids: number[]) {
    this.ensureCanManageReviews(user);
    const normalizedIds = [...new Set((ids ?? []).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 200);
    if (normalizedIds.length === 0) {
      throw new BadRequestException("请至少选择一条催办任务");
    }
    const updated = await this.prisma.reviewNudgeTask.updateMany({
      where: {
        creatorUserId: user.id,
        id: { in: normalizedIds }
      },
      data: {
        status: "PENDING"
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "REVIEW_NUDGE_BATCH_RETRY",
        targetType: "review_nudge_task",
        targetId: normalizedIds.join(","),
        afterJson: {
          count: updated.count
        }
      }
    });

    return {
      count: updated.count
    };
  }
}
