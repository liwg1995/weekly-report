import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { OrgService } from "./org.service";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN")
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Post("departments")
  createDepartment(
    @Body() body: { name: string; reportDueWeekday?: number }
  ) {
    return this.orgService.createDepartment(body);
  }

  @Get("departments")
  listDepartments() {
    return this.orgService.listDepartments();
  }

  @Post("users")
  createUser(@Body() body: { username: string; realName: string }) {
    return this.orgService.createUser(body);
  }

  @Get("users")
  listUsers() {
    return this.orgService.listUsers();
  }
}
