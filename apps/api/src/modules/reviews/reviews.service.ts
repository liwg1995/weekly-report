import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ReportStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

type ReviewDecision = "APPROVED" | "REJECTED";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async review(
    reportId: number,
    reviewerUserId: number,
    input: { decision: ReviewDecision; comment: string },
    reviewerRoles: string[]
  ) {
    const report = await this.prisma.weeklyReport.findUnique({
      where: { id: reportId },
      include: {
        user: {
          include: {
            userDepartments: true
          }
        }
      }
    });
    if (!report) {
      throw new NotFoundException("周报不存在");
    }
    await this.ensureCanReview(report.userId, reviewerUserId, reviewerRoles);

    const review = await this.prisma.reportReview.create({
      data: {
        reportId,
        reviewerUserId,
        decision: input.decision,
        comment: input.comment
      }
    });

    if (input.decision === "APPROVED") {
      await this.prisma.weeklyReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.APPROVED,
          approvedAt: new Date()
        }
      });
      await this.prisma.auditLog.create({
        data: {
          actorUserId: reviewerUserId,
          action: "REVIEW_APPROVED",
          targetType: "weekly_report",
          targetId: String(reportId),
          afterJson: {
            decision: input.decision,
            comment: input.comment
          }
        }
      });
    } else {
      await this.prisma.weeklyReport.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.REJECTED,
          rejectedAt: new Date()
        }
      });
      await this.prisma.auditLog.create({
        data: {
          actorUserId: reviewerUserId,
          action: "REVIEW_REJECTED",
          targetType: "weekly_report",
          targetId: String(reportId),
          afterJson: {
            decision: input.decision,
            comment: input.comment
          }
        }
      });
    }

    try {
      await this.notificationsService.sendReviewDecisionNotification({
        reportId,
        reviewerUserId,
        employeeUserId: report.userId,
        decision: input.decision,
        comment: input.comment
      });
    } catch {
      // Never block review flow due to notification channel errors.
    }

    return review;
  }

  private async ensureCanReview(
    reportUserId: number,
    reviewerUserId: number,
    reviewerRoles: string[]
  ) {
    if (reviewerRoles.includes("SUPER_ADMIN")) {
      return;
    }

    if (reviewerRoles.includes("LEADER")) {
      const directReport = await this.prisma.user.findFirst({
        where: {
          id: reportUserId,
          leaderUserId: reviewerUserId
        },
        select: { id: true }
      });
      if (directReport) {
        return;
      }
    }

    const reportUserDepts = await this.prisma.userDepartment.findMany({
      where: { userId: reportUserId },
      select: { departmentId: true }
    });
    const deptIds = reportUserDepts.map((item) => item.departmentId);
    if (deptIds.length === 0) {
      throw new ForbiddenException("无审批权限");
    }

    if (reviewerRoles.includes("MANAGER")) {
      const managed = await this.prisma.department.findFirst({
        where: {
          id: { in: deptIds },
          managerUserId: reviewerUserId
        },
        select: { id: true }
      });
      if (managed) {
        return;
      }
    }

    if (reviewerRoles.includes("DEPT_ADMIN")) {
      const adminRelation = await this.prisma.userDepartment.findFirst({
        where: {
          userId: reviewerUserId,
          roleInDept: "admin",
          departmentId: { in: deptIds }
        },
        select: { id: true }
      });
      if (adminRelation) {
        return;
      }
    }

    throw new ForbiddenException("无审批权限");
  }
}
