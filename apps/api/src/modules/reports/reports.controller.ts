import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser } from "../auth/auth.service";
import { ReportsService } from "./reports.service";

type UserRequest = Request & { user: AuthUser };

@Controller("weekly-reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(
    @Req() request: Request,
    @Body()
    body: {
      cycleId: number;
      thisWeekText: string;
      nextWeekText: string;
      risksText: string;
      needsHelpText: string;
      mentionLeader?: boolean;
      mentionComment?: string;
    }
  ) {
    return this.reportsService.create((request as UserRequest).user.id, body);
  }

  @Patch(":id")
  update(
    @Req() request: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { action: "resubmit" | "markRejected" }
  ) {
    return this.reportsService.update(
      id,
      body.action,
      (request as UserRequest).user.id
    );
  }

  @Get()
  list(
    @Req() request: Request,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("keyword") keyword?: string,
    @Query("departmentId") departmentId?: string,
    @Query("leaderUserId") leaderUserId?: string,
    @Query("overdueFirst") overdueFirst?: string,
    @Query("mentionLeaderOnly") mentionLeaderOnly?: string,
    @Query("mentionFirst") mentionFirst?: string,
    @Query("myDirectOnly") myDirectOnly?: string
  ) {
    return this.reportsService.list((request as UserRequest).user, {
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      departmentId: departmentId ? Number(departmentId) : undefined,
      leaderUserId: leaderUserId ? Number(leaderUserId) : undefined,
      overdueFirst: overdueFirst === "true",
      mentionLeaderOnly: mentionLeaderOnly === "true",
      mentionFirst: mentionFirst === "true",
      myDirectOnly: myDirectOnly === "true"
    });
  }

  @Get("filter-options")
  filterOptions(@Req() request: Request, @Query("status") status?: string) {
    return this.reportsService.filterOptions((request as UserRequest).user, status);
  }

  @Get("mine/feedback")
  myFeedback(@Req() request: Request) {
    return this.reportsService.myFeedback((request as UserRequest).user.id);
  }

  @Get(":id/timeline")
  reviewTimeline(@Req() request: Request, @Param("id", ParseIntPipe) id: number) {
    return this.reportsService.reviewTimeline(id, (request as UserRequest).user);
  }
}
