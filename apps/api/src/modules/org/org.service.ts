import { Injectable } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  async createDepartment(input: { name: string; reportDueWeekday?: number }) {
    return this.prisma.department.create({
      data: {
        name: input.name,
        reportDueWeekday: input.reportDueWeekday ?? 5
      }
    });
  }

  async listDepartments() {
    const items = await this.prisma.department.findMany({
      orderBy: { id: "desc" }
    });
    return { items };
  }

  async createUser(input: { username: string; realName: string }) {
    const passwordHash = hashSync("123456", 10);
    return this.prisma.user.upsert({
      where: { username: input.username },
      update: { realName: input.realName },
      create: {
        username: input.username,
        realName: input.realName,
        passwordHash,
        status: UserStatus.ACTIVE
      },
      select: {
        id: true,
        username: true,
        realName: true,
        email: true,
        status: true,
        createdAt: true
      }
    });
  }

  async listUsers() {
    const items = await this.prisma.user.findMany({
      orderBy: { id: "desc" },
      select: {
        id: true,
        username: true,
        realName: true,
        email: true,
        status: true,
        createdAt: true
      }
    });
    return { items };
  }
}
