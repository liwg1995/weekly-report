import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { AuditService } from "./audit.service";

type RequestUser = {
  id?: number;
  roles?: string[];
};

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN", "DEPT_ADMIN", "MANAGER")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  private resolveOwnerUserId(req: Request, ownerUserId?: string): number {
    const user = req.user as RequestUser | undefined;
    const requesterId = user?.id;
    if (!requesterId) {
      return 0;
    }
    if (!ownerUserId) {
      return requesterId;
    }

    const parsedOwnerId = Number(ownerUserId);
    if (Number.isNaN(parsedOwnerId)) {
      throw new BadRequestException("ownerUserId 非法");
    }

    const isSuperAdmin = (user?.roles ?? []).includes("SUPER_ADMIN");
    if (!isSuperAdmin && parsedOwnerId !== requesterId) {
      throw new ForbiddenException("仅超级管理员可查看或管理其他用户模板");
    }
    return parsedOwnerId;
  }

  @Get("review-templates")
  listReviewTemplates(
    @Req() req: Request,
    @Query("ownerUserId") ownerUserId?: string
  ) {
    const resolvedOwnerUserId = this.resolveOwnerUserId(req, ownerUserId);
    if (!resolvedOwnerUserId) {
      return { items: [] };
    }
    return this.auditService.listReviewExportTemplates(resolvedOwnerUserId);
  }

  @Get("review-templates/:id/versions")
  listTemplateVersions(
    @Req() req: Request,
    @Param("id") templateId: string,
    @Query("ownerUserId") ownerUserId?: string
  ) {
    const resolvedOwnerUserId = this.resolveOwnerUserId(req, ownerUserId);
    if (!resolvedOwnerUserId) {
      return { items: [] };
    }
    return this.auditService.listReviewExportTemplateVersions(
      resolvedOwnerUserId,
      templateId
    );
  }

  @Post("review-templates")
  async upsertReviewTemplate(
    @Req() req: Request,
    @Body()
    body: {
      ownerUserId?: number;
      item?: {
        id: string;
        name: string;
        createdAt?: string;
        pinned?: boolean;
        diffExportMaskSensitive?: boolean;
        filters?: {
          decision?: "all" | "APPROVED" | "REJECTED";
          actorKeyword?: string;
          dateFrom?: string;
          dateTo?: string;
        };
        columns?: {
          time?: boolean;
          actor?: boolean;
          action?: boolean;
          targetId?: boolean;
        };
        encoding?: "utf-8" | "gbk";
      };
    }
  ) {
    const resolvedOwnerUserId = this.resolveOwnerUserId(
      req,
      body.ownerUserId ? String(body.ownerUserId) : undefined
    );
    if (!resolvedOwnerUserId) {
      return { item: null };
    }

    if (!body.item) {
      throw new BadRequestException("缺少模板数据");
    }
    try {
      return await this.auditService.upsertReviewExportTemplate(
        resolvedOwnerUserId,
        body.item
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException("模板保存失败");
    }
  }

  @Patch("review-templates/:id")
  async updateReviewTemplate(
    @Req() req: Request,
    @Param("id") templateId: string,
    @Body()
    body: {
      ownerUserId?: number;
      item?: {
        name?: string;
        createdAt?: string;
        pinned?: boolean;
        diffExportMaskSensitive?: boolean;
        filters?: {
          decision?: "all" | "APPROVED" | "REJECTED";
          actorKeyword?: string;
          dateFrom?: string;
          dateTo?: string;
        };
        columns?: {
          time?: boolean;
          actor?: boolean;
          action?: boolean;
          targetId?: boolean;
        };
        encoding?: "utf-8" | "gbk";
      };
    }
  ) {
    const resolvedOwnerUserId = this.resolveOwnerUserId(
      req,
      body.ownerUserId ? String(body.ownerUserId) : undefined
    );
    if (!resolvedOwnerUserId) {
      return { item: null };
    }

    try {
      return await this.auditService.updateReviewExportTemplate(
        resolvedOwnerUserId,
        templateId,
        body.item ?? {}
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException("模板更新失败");
    }
  }

  @Delete("review-templates/:id")
  deleteReviewTemplate(
    @Req() req: Request,
    @Param("id") templateId: string,
    @Query("ownerUserId") ownerUserId?: string
  ) {
    const resolvedOwnerUserId = this.resolveOwnerUserId(req, ownerUserId);
    if (!resolvedOwnerUserId) {
      return { success: false };
    }
    return this.auditService.deleteReviewExportTemplate(
      resolvedOwnerUserId,
      templateId
    );
  }

  @Post("review-templates/:id/rollback")
  rollbackReviewTemplate(
    @Req() req: Request,
    @Param("id") templateId: string,
    @Body() body: { ownerUserId?: number; versionId?: number }
  ) {
    const resolvedOwnerUserId = this.resolveOwnerUserId(
      req,
      body.ownerUserId ? String(body.ownerUserId) : undefined
    );
    if (!resolvedOwnerUserId) {
      return { item: null };
    }
    if (!body.versionId) {
      throw new BadRequestException("缺少 versionId");
    }
    return this.auditService.rollbackReviewExportTemplate(
      resolvedOwnerUserId,
      templateId,
      body.versionId
    );
  }

  @Post("review-templates/sync")
  syncReviewTemplates(
    @Req() req: Request,
    @Body() body: { items?: Array<Record<string, unknown>>; ownerUserId?: number }
  ) {
    const resolvedOwnerUserId = this.resolveOwnerUserId(
      req,
      body.ownerUserId ? String(body.ownerUserId) : undefined
    );
    if (!resolvedOwnerUserId) {
      return { items: [] };
    }
    try {
      return this.auditService.syncReviewExportTemplates(
        resolvedOwnerUserId,
        (body.items ?? []) as Array<{
          id: string;
          name: string;
          createdAt?: string;
          pinned?: boolean;
          diffExportMaskSensitive?: boolean;
          filters?: {
            decision?: "all" | "APPROVED" | "REJECTED";
            actorKeyword?: string;
            dateFrom?: string;
            dateTo?: string;
          };
          columns?: {
            time?: boolean;
            actor?: boolean;
            action?: boolean;
            targetId?: boolean;
          };
          encoding?: "utf-8" | "gbk";
        }>
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException("模板同步失败");
    }
  }

  @Get("reviews")
  recentReviewLogs(
    @Query("limit") limit?: string,
    @Query("decision") decision?: "APPROVED" | "REJECTED" | "all",
    @Query("actorKeyword") actorKeyword?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string
  ) {
    const parsed = Number(limit);
    return this.auditService.recentReviewLogs({
      limit: Number.isNaN(parsed) ? 10 : parsed,
      decision,
      actorKeyword,
      dateFrom,
      dateTo
    });
  }
}
