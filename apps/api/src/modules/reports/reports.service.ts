import { Injectable, NotFoundException } from "@nestjs/common";
import { CycleStatus, Prisma, ReportStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../auth/auth.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
    query?: { status?: string; page?: number; pageSize?: number; keyword?: string }
  ) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 20));
    const keyword = query?.keyword?.trim();
    const status = query?.status;

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

    const where: Prisma.WeeklyReportWhereInput = {
      ...(status ? { status: status as ReportStatus } : {}),
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

    const [total, items] = await this.prisma.$transaction([
      this.prisma.weeklyReport.count({ where }),
      this.prisma.weeklyReport.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              realName: true,
              leaderUserId: true
            }
          }
        }
      })
    ]);

    return { items, total, page, pageSize };
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
}
