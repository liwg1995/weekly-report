import { Injectable } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  async createDepartment(
    actorUserId: number,
    input: { name: string; reportDueWeekday?: number; parentId?: number | null; managerUserId?: number | null }
  ) {
    const created = await this.prisma.department.create({
      data: {
        name: input.name,
        reportDueWeekday: input.reportDueWeekday ?? 5,
        parentId: input.parentId ?? null,
        managerUserId: input.managerUserId ?? null
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "ORG_DEPARTMENT_CREATED",
        targetType: "department",
        targetId: String(created.id),
        beforeJson: Prisma.JsonNull,
        afterJson: {
          name: created.name,
          parentId: created.parentId,
          managerUserId: created.managerUserId,
          reportDueWeekday: created.reportDueWeekday
        }
      }
    });
    return created;
  }

  async updateDepartment(
    actorUserId: number,
    departmentId: number,
    input: { name?: string; reportDueWeekday?: number; parentId?: number | null; managerUserId?: number | null }
  ) {
    const before = await this.prisma.department.findUnique({
      where: { id: departmentId }
    });
    if (!before) {
      throw new Error("部门不存在");
    }
    if (input.parentId !== undefined && input.parentId === departmentId) {
      throw new Error("上级部门不能是当前部门");
    }

    const updated = await this.prisma.department.update({
      where: { id: departmentId },
      data: {
        name: input.name,
        reportDueWeekday: input.reportDueWeekday,
        parentId: input.parentId,
        managerUserId: input.managerUserId
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "ORG_DEPARTMENT_UPDATED",
        targetType: "department",
        targetId: String(departmentId),
        beforeJson: {
          name: before.name,
          parentId: before.parentId,
          managerUserId: before.managerUserId,
          reportDueWeekday: before.reportDueWeekday
        },
        afterJson: {
          name: updated.name,
          parentId: updated.parentId,
          managerUserId: updated.managerUserId,
          reportDueWeekday: updated.reportDueWeekday
        }
      }
    });
    return updated;
  }

  async listDepartments(query?: { page?: number; pageSize?: number; keyword?: string }) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 20));
    const keyword = query?.keyword?.trim();
    const where = keyword
      ? {
          name: {
            contains: keyword
          }
        }
      : undefined;
    const [total, items] = await this.prisma.$transaction([
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    return { items, total, page, pageSize };
  }

  async upsertUser(
    actorUserId: number,
    input: { username: string; realName: string; leaderUserId?: number | null }
  ) {
    const passwordHash = hashSync("123456", 10);
    const before = await this.prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true, realName: true, leaderUserId: true }
    });

    const saved = await this.prisma.user.upsert({
      where: { username: input.username },
      update: {
        realName: input.realName,
        leaderUserId: input.leaderUserId
      },
      create: {
        username: input.username,
        realName: input.realName,
        passwordHash,
        status: UserStatus.ACTIVE,
        leaderUserId: input.leaderUserId
      },
      select: {
        id: true,
        username: true,
        realName: true,
        email: true,
        status: true,
        leaderUserId: true,
        createdAt: true
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: before ? "ORG_USER_UPDATED" : "ORG_USER_CREATED",
        targetType: "user",
        targetId: String(saved.id),
        beforeJson: before
          ? {
              realName: before.realName,
              leaderUserId: before.leaderUserId
            }
          : Prisma.JsonNull,
        afterJson: {
          realName: saved.realName,
          leaderUserId: saved.leaderUserId
        }
      }
    });
    return saved;
  }

  async assignUserDepartment(
    actorUserId: number,
    input: {
      userId: number;
      departmentId: number;
      roleInDept?: string;
      isPrimary?: boolean;
    }
  ) {
    const roleInDept = (input.roleInDept ?? "member").trim().toLowerCase();
    const saved = await this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.userDepartment.updateMany({
          where: { userId: input.userId },
          data: { isPrimary: false }
        });
      }
      return tx.userDepartment.upsert({
        where: {
          userId_departmentId: {
            userId: input.userId,
            departmentId: input.departmentId
          }
        },
        update: {
          roleInDept,
          isPrimary: Boolean(input.isPrimary)
        },
        create: {
          userId: input.userId,
          departmentId: input.departmentId,
          roleInDept,
          isPrimary: Boolean(input.isPrimary)
        }
      });
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "ORG_USER_DEPARTMENT_ASSIGNED",
        targetType: "user_department",
        targetId: String(saved.id),
        beforeJson: Prisma.JsonNull,
        afterJson: {
          userId: saved.userId,
          departmentId: saved.departmentId,
          roleInDept: saved.roleInDept,
          isPrimary: saved.isPrimary
        }
      }
    });
    return saved;
  }

  async setUserLeader(
    actorUserId: number,
    input: { userId: number; leaderUserId: number | null }
  ) {
    if (input.leaderUserId !== null && input.userId === input.leaderUserId) {
      throw new Error("直属领导不能是本人");
    }

    const before = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { leaderUserId: true }
    });
    if (!before) {
      throw new Error("员工不存在");
    }

    const updated = await this.prisma.user.update({
      where: { id: input.userId },
      data: { leaderUserId: input.leaderUserId },
      select: {
        id: true,
        username: true,
        realName: true,
        leaderUserId: true
      }
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "ORG_USER_LEADER_UPDATED",
        targetType: "user",
        targetId: String(updated.id),
        beforeJson: { leaderUserId: before.leaderUserId },
        afterJson: { leaderUserId: updated.leaderUserId }
      }
    });
    return updated;
  }

  async listUsers(query?: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    departmentId?: number;
  }) {
    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 20));
    const keyword = query?.keyword?.trim();
    const departmentId = query?.departmentId;

    const where = {
      ...(keyword
        ? {
            OR: [
              { username: { contains: keyword } },
              { realName: { contains: keyword } }
            ]
          }
        : {}),
      ...(departmentId
        ? {
            userDepartments: {
              some: { departmentId }
            }
          }
        : {})
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { id: "desc" },
      select: {
        id: true,
        username: true,
        realName: true,
        email: true,
        status: true,
        leaderUserId: true,
        leader: {
          select: {
            id: true,
            username: true,
            realName: true
          }
        },
        userDepartments: {
          select: {
            departmentId: true,
            roleInDept: true,
            isPrimary: true,
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        createdAt: true
      }
    })
    ]);
    return { items, total, page, pageSize };
  }
}
