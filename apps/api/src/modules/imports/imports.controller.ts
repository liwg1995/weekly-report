import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthUser } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ImportsService } from "./imports.service";

type UserRequest = Request & { user: AuthUser };

@Controller("imports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN")
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post("employees")
  createEmployeeImport(
    @Req() request: Request,
    @Body() body: { fileName: string }
  ) {
    return this.importsService.createEmployeeImport({
      fileName: body.fileName,
      operatorUserId: (request as UserRequest).user.id
    });
  }
}
