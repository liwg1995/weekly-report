import { Injectable, NotFoundException } from "@nestjs/common";
import { CycleStatus, ReportStatus } from "@prisma/client";
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

  async list(status?: string) {
    const items = await this.prisma.weeklyReport.findMany({
      where: status ? { status: status as ReportStatus } : undefined,
      orderBy: { id: "desc" }
    });
    return { items };
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
