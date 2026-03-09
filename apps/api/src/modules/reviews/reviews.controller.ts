import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { AuthUser } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ReviewsService } from "./reviews.service";

type UserRequest = Request & { user: AuthUser };

@Controller("weekly-reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(":id/review")
  @Roles("SUPER_ADMIN", "DEPT_ADMIN", "MANAGER", "LEADER")
  review(
    @Req() request: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { decision: "APPROVED" | "REJECTED"; comment: string }
  ) {
    return this.reviewsService.review(
      id,
      (request as UserRequest).user.id,
      body,
      (request as UserRequest).user.roles
    );
  }
}
