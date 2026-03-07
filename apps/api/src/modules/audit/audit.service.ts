import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type ReviewLogFilters = {
  limit?: number;
  decision?: "APPROVED" | "REJECTED" | "all";
  actorKeyword?: string;
  dateFrom?: string;
  dateTo?: string;
};

type ExportTemplateColumnMap = {
  time: boolean;
  actor: boolean;
  action: boolean;
  targetId: boolean;
};

type TemplateFilters = {
  decision?: "all" | "APPROVED" | "REJECTED";
  actorKeyword?: string;
  dateFrom?: string;
  dateTo?: string;
};

type ReviewExportTemplatePayload = {
  id: string;
  name: string;
  createdAt?: string;
  pinned?: boolean;
  diffExportMaskSensitive?: boolean;
  filters?: TemplateFilters;
  columns?: Partial<ExportTemplateColumnMap>;
  encoding?: "utf-8" | "gbk";
};

type ReviewExportTemplateUpdatePayload = {
  name?: string;
  createdAt?: string;
  pinned?: boolean;
  diffExportMaskSensitive?: boolean;
  filters?: TemplateFilters;
  columns?: Partial<ExportTemplateColumnMap>;
  encoding?: "utf-8" | "gbk";
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private toInputJsonValue(
    value: Prisma.JsonValue
  ): Prisma.InputJsonValue | Prisma.JsonNullValueInput {
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private normalizeTemplatePayload(
    item: ReviewExportTemplatePayload,
    index: number
  ) {
    const id = item.id?.trim();
    const name = item.name?.trim();
    if (!id) {
      throw new Error(`第 ${index + 1} 条模板缺少 id`);
    }
    if (!name) {
      throw new Error(`第 ${index + 1} 条模板缺少 name`);
    }

    return {
      id,
      name,
      createdAt:
        item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
          ? new Date(item.createdAt)
          : new Date(),
      pinned: Boolean(item.pinned),
      diffExportMaskSensitive:
        typeof item.diffExportMaskSensitive === "boolean"
          ? item.diffExportMaskSensitive
          : true,
      filtersJson: {
        decision:
          item.filters?.decision === "APPROVED" || item.filters?.decision === "REJECTED"
            ? item.filters.decision
            : "all",
        actorKeyword: item.filters?.actorKeyword ?? "",
        dateFrom: item.filters?.dateFrom ?? "",
        dateTo: item.filters?.dateTo ?? ""
      } as Prisma.JsonObject,
      columnsJson: {
        time: item.columns?.time ?? true,
        actor: item.columns?.actor ?? true,
        action: item.columns?.action ?? true,
        targetId: item.columns?.targetId ?? true
      } as Prisma.JsonObject,
      encoding: item.encoding === "gbk" ? "gbk" : "utf-8"
    };
  }

  private normalizeTemplateUpdate(item: ReviewExportTemplateUpdatePayload) {
    const payload: {
      name?: string;
      createdAt?: Date;
      pinned?: boolean;
      diffExportMaskSensitive?: boolean;
      filtersJson?: Prisma.JsonObject;
      columnsJson?: Prisma.JsonObject;
      encoding?: string;
    } = {};

    if (typeof item.name === "string") {
      const nextName = item.name.trim();
      if (!nextName) {
        throw new Error("模板名称不能为空");
      }
      payload.name = nextName;
    }
    if (item.createdAt) {
      const date = new Date(item.createdAt);
      if (!Number.isNaN(date.getTime())) {
        payload.createdAt = date;
      }
    }
    if (typeof item.pinned === "boolean") {
      payload.pinned = item.pinned;
    }
    if (typeof item.diffExportMaskSensitive === "boolean") {
      payload.diffExportMaskSensitive = item.diffExportMaskSensitive;
    }
    if (item.filters) {
      payload.filtersJson = {
        decision:
          item.filters.decision === "APPROVED" || item.filters.decision === "REJECTED"
            ? item.filters.decision
            : "all",
        actorKeyword: item.filters.actorKeyword ?? "",
        dateFrom: item.filters.dateFrom ?? "",
        dateTo: item.filters.dateTo ?? ""
      };
    }
    if (item.columns) {
      payload.columnsJson = {
        time: item.columns.time ?? true,
        actor: item.columns.actor ?? true,
        action: item.columns.action ?? true,
        targetId: item.columns.targetId ?? true
      };
    }
    if (item.encoding) {
      payload.encoding = item.encoding === "gbk" ? "gbk" : "utf-8";
    }
    return payload;
  }

  private mapTemplate(item: {
    id: string;
    name: string;
    createdAt: Date;
    pinned: boolean;
    diffExportMaskSensitive: boolean;
    filtersJson: Prisma.JsonValue;
    columnsJson: Prisma.JsonValue;
    encoding: string;
  }) {
    return {
      id: item.id,
      name: item.name,
      createdAt: item.createdAt.toISOString(),
      pinned: item.pinned,
      diffExportMaskSensitive: item.diffExportMaskSensitive,
      filters: item.filtersJson,
      columns: item.columnsJson,
      encoding: item.encoding === "gbk" ? "gbk" : "utf-8"
    };
  }

  private async createTemplateVersion(
    tx: Prisma.TransactionClient,
    template: {
      id: string;
      ownerUserId: number;
      name: string;
      pinned: boolean;
      diffExportMaskSensitive: boolean;
      filtersJson: Prisma.JsonValue;
      columnsJson: Prisma.JsonValue;
      encoding: string;
    }
  ) {
    await tx.reviewExportTemplateVersion.create({
      data: {
        templateId: template.id,
        ownerUserId: template.ownerUserId,
        name: template.name,
        pinned: template.pinned,
        diffExportMaskSensitive: template.diffExportMaskSensitive,
        filtersJson: this.toInputJsonValue(template.filtersJson),
        columnsJson: this.toInputJsonValue(template.columnsJson),
        encoding: template.encoding
      }
    });
  }

  async listReviewExportTemplates(ownerUserId: number) {
    const items = await this.prisma.reviewExportTemplate.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: "desc" }
    });
    return {
      items: items.map((item) => this.mapTemplate(item))
    };
  }

  async listReviewExportTemplateVersions(ownerUserId: number, templateId: string) {
    const items = await this.prisma.reviewExportTemplateVersion.findMany({
      where: {
        ownerUserId,
        templateId
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        templateId: item.templateId,
        createdAt: item.createdAt.toISOString(),
        name: item.name,
        pinned: item.pinned,
        diffExportMaskSensitive: item.diffExportMaskSensitive,
        filters: item.filtersJson,
        columns: item.columnsJson,
        encoding: item.encoding === "gbk" ? "gbk" : "utf-8"
      }))
    };
  }

  async upsertReviewExportTemplate(ownerUserId: number, payload: ReviewExportTemplatePayload) {
    const normalized = this.normalizeTemplatePayload(payload, 0);

    try {
      const template = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.reviewExportTemplate.upsert({
          where: { id: normalized.id },
          update: {
            ownerUserId,
            name: normalized.name,
            pinned: normalized.pinned,
            diffExportMaskSensitive: normalized.diffExportMaskSensitive,
            filtersJson: normalized.filtersJson,
            columnsJson: normalized.columnsJson,
            encoding: normalized.encoding,
            createdAt: normalized.createdAt
          },
          create: {
            id: normalized.id,
            ownerUserId,
            name: normalized.name,
            pinned: normalized.pinned,
            diffExportMaskSensitive: normalized.diffExportMaskSensitive,
            filtersJson: normalized.filtersJson,
            columnsJson: normalized.columnsJson,
            encoding: normalized.encoding,
            createdAt: normalized.createdAt
          }
        });
        await this.createTemplateVersion(tx, saved);
        return saved;
      });
      return { item: this.mapTemplate(template) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("同名模板已存在");
      }
      throw error;
    }
  }

  async updateReviewExportTemplate(
    ownerUserId: number,
    templateId: string,
    payload: ReviewExportTemplateUpdatePayload
  ) {
    const normalized = this.normalizeTemplateUpdate(payload);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existed = await tx.reviewExportTemplate.findFirst({
          where: {
            id: templateId,
            ownerUserId
          }
        });
        if (!existed) {
          throw new NotFoundException("模板不存在");
        }
        const saved = await tx.reviewExportTemplate.update({
          where: { id: templateId },
          data: {
            ...normalized,
            ownerUserId
          }
        });
        await this.createTemplateVersion(tx, saved);
        return saved;
      });

      return { item: this.mapTemplate(updated) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("同名模板已存在");
      }
      throw error;
    }
  }

  async deleteReviewExportTemplate(ownerUserId: number, templateId: string) {
    const existed = await this.prisma.reviewExportTemplate.findFirst({
      where: {
        id: templateId,
        ownerUserId
      }
    });
    if (!existed) {
      throw new NotFoundException("模板不存在");
    }
    await this.prisma.reviewExportTemplate.delete({
      where: { id: templateId }
    });
    return { success: true };
  }

  async rollbackReviewExportTemplate(
    ownerUserId: number,
    templateId: string,
    versionId: number
  ) {
    const version = await this.prisma.reviewExportTemplateVersion.findFirst({
      where: {
        id: versionId,
        ownerUserId,
        templateId
      }
    });
    if (!version) {
      throw new NotFoundException("模板版本不存在");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.reviewExportTemplate.findFirst({
        where: {
          id: templateId,
          ownerUserId
        }
      });
      if (!current) {
        throw new NotFoundException("模板不存在");
      }
      const saved = await tx.reviewExportTemplate.update({
        where: { id: templateId },
        data: {
          name: version.name,
          pinned: version.pinned,
          diffExportMaskSensitive: version.diffExportMaskSensitive,
          filtersJson: this.toInputJsonValue(version.filtersJson),
          columnsJson: this.toInputJsonValue(version.columnsJson),
          encoding: version.encoding,
          createdAt: new Date()
        }
      });
      await this.createTemplateVersion(tx, saved);
      return saved;
    });

    return { item: this.mapTemplate(updated) };
  }

  async syncReviewExportTemplates(ownerUserId: number, payload: ReviewExportTemplatePayload[]) {
    const normalized = payload
      .slice(0, 20)
      .map((item, index) => this.normalizeTemplatePayload(item, index));

    await this.prisma.$transaction(async (tx) => {
      await tx.reviewExportTemplateVersion.deleteMany({ where: { ownerUserId } });
      await tx.reviewExportTemplate.deleteMany({ where: { ownerUserId } });
      if (normalized.length > 0) {
        await tx.reviewExportTemplate.createMany({
          data: normalized.map((item) => ({
            id: item.id,
            ownerUserId,
            name: item.name,
            createdAt: item.createdAt,
            pinned: item.pinned,
            diffExportMaskSensitive: item.diffExportMaskSensitive,
            filtersJson: item.filtersJson,
            columnsJson: item.columnsJson,
            encoding: item.encoding
          }))
        });
        const reloaded = await tx.reviewExportTemplate.findMany({
          where: { ownerUserId }
        });
        for (const item of reloaded) {
          await this.createTemplateVersion(tx, item);
        }
      }
    });

    return this.listReviewExportTemplates(ownerUserId);
  }

  async recentReviewLogs(filters: ReviewLogFilters = {}) {
    const take = Math.min(Math.max(filters.limit ?? 10, 1), 100);
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.decision === "APPROVED") {
      where.action = "REVIEW_APPROVED";
    } else if (filters.decision === "REJECTED") {
      where.action = "REVIEW_REJECTED";
    } else {
      where.action = {
        in: ["REVIEW_APPROVED", "REVIEW_REJECTED"]
      };
    }

    const actorKeyword = filters.actorKeyword?.trim();
    if (actorKeyword) {
      where.actor = {
        OR: [{ username: { contains: actorKeyword } }, { realName: { contains: actorKeyword } }]
      };
    }

    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : null;
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter),
        gte: dateFrom
      };
    }
    if (dateTo && !Number.isNaN(dateTo.getTime())) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter),
        lte: endOfDay
      };
    }

    const items = await this.prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            realName: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take
    });
    return { items };
  }
}
