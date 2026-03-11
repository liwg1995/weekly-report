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

  @Post("review-nudges")
  createReviewNudgeTask(
    @Req() request: Request,
    @Body()
    body: {
      level: "SLA24" | "SLA48";
      targetReportIds?: number[];
    }
  ) {
    return this.reportsService.createReviewNudgeTask((request as UserRequest).user, body);
  }

  @Get("review-nudges")
  reviewNudgeTasks(
    @Req() request: Request,
    @Query("limit") limit?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("status") status?: string,
    @Query("level") level?: string
  ) {
    return this.reportsService.listReviewNudgeTasks((request as UserRequest).user, {
      limit: limit ? Number(limit) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      status,
      level
    });
  }

  @Patch("review-nudges/:id")
  updateReviewNudgeTask(
    @Req() request: Request,
    @Param("id", ParseIntPipe) id: number,
    @Body()
    body: {
      action: "markSent" | "markFailed" | "retry";
    }
  ) {
    return this.reportsService.updateReviewNudgeTask((request as UserRequest).user, id, body.action);
  }

  @Post("review-nudges/retry-batch")
  retryReviewNudgeTasks(
    @Req() request: Request,
    @Body() body: { ids: number[] }
  ) {
    return this.reportsService.retryReviewNudgeTasks((request as UserRequest).user, body.ids ?? []);
  }

  @Get(":id/timeline")
  reviewTimeline(@Req() request: Request, @Param("id", ParseIntPipe) id: number) {
    return this.reportsService.reviewTimeline(id, (request as UserRequest).user);
  }
}
