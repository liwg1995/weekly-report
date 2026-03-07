import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN", "DEPT_ADMIN", "MANAGER")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("channels")
  getChannels() {
    return this.notificationsService.getChannels();
  }
}

