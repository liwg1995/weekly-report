import {
  Injectable,
  OnModuleInit,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { compareSync, hashSync } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

export type AuthUser = {
  id: number;
  username: string;
  realName: string;
  roles: string[];
};

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    const adminPassword = process.env.ADMIN_PASSWORD ?? "123456";
    try {
      await this.prisma.user.upsert({
        where: { username: "admin" },
        update: {},
        create: {
          username: "admin",
          realName: "系统管理员",
          passwordHash: hashSync(adminPassword, 10),
          status: UserStatus.ACTIVE
        }
      });
    } catch (error) {
      // Jest may bootstrap multiple app instances concurrently.
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }
  }

  private buildAuthResponse(user: AuthUser) {
    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        username: user.username,
        realName: user.realName,
        roles: user.roles
      }),
      user
    };
  }

  private async resolveRoles(userId: number, username: string): Promise<string[]> {
    const roles = new Set<string>();
    if (username === "admin") {
      roles.add("SUPER_ADMIN");
    }

    const deptRelations = await this.prisma.userDepartment.findMany({
      where: { userId },
      select: { roleInDept: true }
    });
    for (const relation of deptRelations) {
      if (relation.roleInDept.toLowerCase() === "admin") {
        roles.add("DEPT_ADMIN");
      }
    }

    const managedCount = await this.prisma.department.count({
      where: { managerUserId: userId }
    });
    if (managedCount > 0) {
      roles.add("MANAGER");
    }

    const directReportCount = await this.prisma.user.count({
      where: { leaderUserId: userId }
    });
    if (directReportCount > 0) {
      roles.add("LEADER");
    }

    if (roles.size === 0) {
      roles.add("EMPLOYEE");
    }
    return Array.from(roles);
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !compareSync(password, user.passwordHash)) {
      throw new UnauthorizedException("用户名或密码错误");
    }
    const roles = await this.resolveRoles(user.id, user.username);

    return this.buildAuthResponse({
      id: user.id,
      username: user.username,
      realName: user.realName,
      roles
    });
  }

  async verifyUser(id: number): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      return null;
    }
    const roles = await this.resolveRoles(user.id, user.username);
    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      roles
    };
  }
}
