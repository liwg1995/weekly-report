import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Delete,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { AuthUser } from "../auth/auth.service";
import { PerformanceCycleStatus } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { PerformanceService } from "./performance.service";

type UserRequest = Request & { user: AuthUser };

@Controller("performance")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN", "DEPT_ADMIN", "MANAGER")
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get("overview")
  getOverview() {
    return this.performanceService.getOverview();
  }

  @Post("cycles")
  createCycle(
    @Req() request: Request,
    @Body()
    body: {
      name: string;
      startDate: string;
      endDate: string;
      status?: PerformanceCycleStatus;
    }
  ) {
    return this.performanceService.createCycle(body, (request as UserRequest).user.id);
  }

  @Post("cycles/:id/dimensions")
  addDimension(
    @Param("id", ParseIntPipe) cycleId: number,
    @Req() request: Request,
    @Body()
    body: {
      key: string;
      name: string;
      weight: number;
      metricHint: string;
    }
  ) {
    return this.performanceService.addDimension(
      cycleId,
      body,
      (request as UserRequest).user.id
    );
  }

  @Patch("cycles/:id")
  updateCycle(
    @Param("id", ParseIntPipe) id: number,
    @Req() request: Request,
    @Body()
    body: {
      name?: string;
      startDate?: string;
      endDate?: string;
      status?: PerformanceCycleStatus;
      version?: number;
    }
  ) {
    return this.performanceService.updateCycle(
      id,
      body,
      (request as UserRequest).user.id
    );
  }

  @Delete("cycles/:id")
  deleteCycle(@Param("id", ParseIntPipe) id: number, @Req() request: Request) {
    return this.performanceService.deleteCycle(id, (request as UserRequest).user.id);
  }

  @Patch("dimensions/:id")
  updateDimension(
    @Param("id", ParseIntPipe) id: number,
    @Req() request: Request,
    @Body()
    body: {
      key?: string;
      name?: string;
      weight?: number;
      metricHint?: string;
      version?: number;
    }
  ) {
    return this.performanceService.updateDimension(
      id,
      body,
      (request as UserRequest).user.id
    );
  }

  @Delete("dimensions/:id")
  deleteDimension(
    @Param("id", ParseIntPipe) id: number,
    @Req() request: Request
  ) {
    return this.performanceService.deleteDimension(id, (request as UserRequest).user.id);
  }

  @Patch("todos/:id")
  updateTodo(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { done: boolean }
  ) {
    return this.performanceService.updateTodo(id, body);
  }
}
