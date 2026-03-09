import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { OrgService } from "./org.service";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN", "DEPT_ADMIN")
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  private getActorUserId(req: Request): number {
    const user = req.user as { id?: number } | undefined;
    if (!user?.id) {
      throw new BadRequestException("缺少用户身份");
    }
    return user.id;
  }

  @Post("departments")
  createDepartment(
    @Req() req: Request,
    @Body()
    body: {
      name: string;
      reportDueWeekday?: number;
      parentId?: number | null;
      managerUserId?: number | null;
    }
  ) {
    return this.orgService.createDepartment(this.getActorUserId(req), body);
  }

  @Patch("departments/:id")
  updateDepartment(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      reportDueWeekday?: number;
      parentId?: number | null;
      managerUserId?: number | null;
    }
  ) {
    return this.orgService.updateDepartment(this.getActorUserId(req), Number(id), body);
  }

  @Get("departments")
  listDepartments(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("keyword") keyword?: string
  ) {
    return this.orgService.listDepartments({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword
    });
  }

  @Post("users")
  createUser(
    @Req() req: Request,
    @Body() body: { username: string; realName: string; leaderUserId?: number | null }
  ) {
    return this.orgService.upsertUser(this.getActorUserId(req), body);
  }

  @Post("users/:id/departments")
  assignUserDepartment(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { departmentId: number; roleInDept?: string; isPrimary?: boolean }
  ) {
    return this.orgService.assignUserDepartment(this.getActorUserId(req), {
      userId: Number(id),
      departmentId: body.departmentId,
      roleInDept: body.roleInDept,
      isPrimary: body.isPrimary
    });
  }

  @Patch("users/:id/leader")
  setUserLeader(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { leaderUserId: number | null }
  ) {
    return this.orgService.setUserLeader(this.getActorUserId(req), {
      userId: Number(id),
      leaderUserId: body.leaderUserId
    });
  }

  @Get("users")
  listUsers(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("keyword") keyword?: string,
    @Query("departmentId") departmentId?: string
  ) {
    return this.orgService.listUsers({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      departmentId: departmentId ? Number(departmentId) : undefined
    });
  }
}
