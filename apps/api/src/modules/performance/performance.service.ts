import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PerformanceCycleStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeForAudit<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient,
    payload: {
      actorUserId: number;
      action: string;
      targetType: string;
      targetId: string;
      beforeJson?: unknown;
      afterJson?: unknown;
    }
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId: payload.actorUserId,
        action: payload.action,
        targetType: payload.targetType,
        targetId: payload.targetId,
        beforeJson: payload.beforeJson === undefined
          ? undefined
          : (this.serializeForAudit(payload.beforeJson) as Prisma.InputJsonValue),
        afterJson: payload.afterJson === undefined
          ? undefined
          : (this.serializeForAudit(payload.afterJson) as Prisma.InputJsonValue)
      }
    });
  }

  private async ensurePlaceholderData() {
    const cycleCount = await this.prisma.performanceCycle.count();
    if (cycleCount === 0) {
      await this.prisma.performanceCycle.create({
        data: {
          name: "2026Q2 绩效周期（占位）",
          startDate: new Date("2026-04-01T00:00:00.000Z"),
          endDate: new Date("2026-06-30T23:59:59.000Z"),
          status: PerformanceCycleStatus.DRAFT,
          dimensions: {
            create: [
              {
                key: "delivery",
                name: "交付质量",
                weight: 40,
                metricHint: "按周报目标完成率与延期率评估"
              },
              {
                key: "collaboration",
                name: "协作反馈",
                weight: 30,
                metricHint: "按跨部门协作与主管建议采纳率评估"
              },
              {
                key: "growth",
                name: "成长改进",
                weight: 30,
                metricHint: "按复盘深度与改进闭环质量评估"
              }
            ]
          }
        }
      });
    }

    const todoCount = await this.prisma.performanceTodo.count();
    if (todoCount === 0) {
      await this.prisma.performanceTodo.createMany({
        data: [
          {
            ownerRole: "SUPER_ADMIN",
            title: "确认评分维度与权重版本化策略",
            done: false
          },
          {
            ownerRole: "DEPT_ADMIN",
            title: "确认部门差异化系数与审批链路",
            done: false
          },
          {
            ownerRole: "MANAGER",
            title: "确认建议文本如何进入绩效证据池",
            done: false
          }
        ]
      });
    }
  }

  async getOverview() {
    await this.ensurePlaceholderData();

    const cycles = await this.prisma.performanceCycle.findMany({
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
      include: {
        dimensions: {
          orderBy: [{ weight: "desc" }, { id: "asc" }]
        }
      }
    });

    const todos = await this.prisma.performanceTodo.findMany({
      orderBy: [{ done: "asc" }, { id: "asc" }]
    });

    return { cycles, todos };
  }

  async createCycle(
    input: {
    name: string;
    startDate: string;
    endDate: string;
    status?: PerformanceCycleStatus;
  },
    actorUserId: number
  ) {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException("周期名称不能为空");
    }
    if (name.length > 64) {
      throw new BadRequestException("周期名称长度不能超过64个字符");
    }

    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("日期格式无效");
    }
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException("结束日期不能早于开始日期");
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.performanceCycle.create({
        data: {
          name,
          startDate,
          endDate,
          status: input.status ?? PerformanceCycleStatus.DRAFT
        }
      });

      await this.createAuditLog(tx, {
        actorUserId,
        action: "PERFORMANCE_CYCLE_CREATED",
        targetType: "performance_cycle",
        targetId: String(created.id),
        afterJson: created
      });

      return created;
    });
  }

  async addDimension(
    cycleId: number,
    input: { key: string; name: string; weight: number; metricHint: string }
    ,
    actorUserId: number
  ) {
    const cycle = await this.prisma.performanceCycle.findUnique({
      where: { id: cycleId },
      select: { id: true }
    });
    if (!cycle) {
      throw new NotFoundException("绩效周期不存在");
    }

    const key = input.key.trim();
    const name = input.name.trim();
    const metricHint = input.metricHint.trim();
    if (!key || !name || !metricHint) {
      throw new BadRequestException("维度字段不能为空");
    }
    if (key.length > 64) {
      throw new BadRequestException("维度Key长度不能超过64个字符");
    }
    if (name.length > 64) {
      throw new BadRequestException("维度名称长度不能超过64个字符");
    }
    if (metricHint.length > 200) {
      throw new BadRequestException("指标说明长度不能超过200个字符");
    }
    if (!Number.isInteger(input.weight) || input.weight <= 0 || input.weight > 100) {
      throw new BadRequestException("权重必须是 1-100 的整数");
    }

    const existingWeight = await this.prisma.performanceDimension.aggregate({
      where: { cycleId },
      _sum: { weight: true }
    });
    const currentSum = existingWeight._sum.weight ?? 0;
    if (currentSum + input.weight > 100) {
      throw new BadRequestException("维度权重总和不能超过100");
    }

    return this.prisma.$transaction(async (tx) => {
      const dimension = await tx.performanceDimension.create({
        data: {
          cycleId,
          key,
          name,
          weight: input.weight,
          metricHint
        }
      });

      await this.createAuditLog(tx, {
        actorUserId,
        action: "PERFORMANCE_DIMENSION_CREATED",
        targetType: "performance_dimension",
        targetId: String(dimension.id),
        afterJson: dimension
      });

      return dimension;
    });
  }

  async updateCycle(
    id: number,
    input: {
      name?: string;
      startDate?: string;
      endDate?: string;
      status?: PerformanceCycleStatus;
    },
    actorUserId: number
  ) {
    return this.prisma.$transaction(async (tx) => {
    const cycle = await tx.performanceCycle.findUnique({
      where: { id },
      select: { id: true, startDate: true, endDate: true, name: true, status: true }
    });
    if (!cycle) {
      throw new NotFoundException("绩效周期不存在");
    }

    const hasPayload = Object.keys(input).length > 0;
    if (!hasPayload) {
      throw new BadRequestException("更新内容不能为空");
    }

    const data: {
      name?: string;
      startDate?: Date;
      endDate?: Date;
      status?: PerformanceCycleStatus;
    } = {};

    const nextStartDate = (() => {
      if (!Object.prototype.hasOwnProperty.call(input, "startDate")) {
        return cycle.startDate;
      }
      if (!input.startDate) {
        throw new BadRequestException("开始日期不能为空");
      }
      const date = new Date(input.startDate);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException("开始日期格式无效");
      }
      data.startDate = date;
      return date;
    })();

    const nextEndDate = (() => {
      if (!Object.prototype.hasOwnProperty.call(input, "endDate")) {
        return cycle.endDate;
      }
      if (!input.endDate) {
        throw new BadRequestException("结束日期不能为空");
      }
      const date = new Date(input.endDate);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException("结束日期格式无效");
      }
      data.endDate = date;
      return date;
    })();

    if (nextEndDate < nextStartDate) {
      throw new BadRequestException("结束日期不能早于开始日期");
    }

    if (Object.prototype.hasOwnProperty.call(input, "name")) {
      const name = input.name?.trim();
      if (!name) {
        throw new BadRequestException("周期名称不能为空");
      }
      if (name.length > 64) {
        throw new BadRequestException("周期名称长度不能超过64个字符");
      }
      data.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(input, "status")) {
      if (!Object.values(PerformanceCycleStatus).includes(input.status as PerformanceCycleStatus)) {
        throw new BadRequestException("绩效状态无效");
      }
      data.status = input.status;
    }

      const updated = await tx.performanceCycle.update({
        where: { id },
        data
      });

      await this.createAuditLog(tx, {
        actorUserId,
        action: "PERFORMANCE_CYCLE_UPDATED",
        targetType: "performance_cycle",
        targetId: String(id),
        beforeJson: cycle,
        afterJson: updated
      });

      return updated;
    });
  }

  async deleteCycle(id: number, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.performanceCycle.findUnique({
        where: { id },
        include: { dimensions: true }
      });
    if (!cycle) {
      throw new NotFoundException("绩效周期不存在");
    }

      await tx.performanceDimension.deleteMany({
        where: { cycleId: id }
      });

      await tx.performanceCycle.delete({
        where: { id }
      });

      await this.createAuditLog(tx, {
        actorUserId,
        action: "PERFORMANCE_CYCLE_DELETED",
        targetType: "performance_cycle",
        targetId: String(id),
        beforeJson: cycle
      });

      return { id };
    });
  }

  async updateDimension(
    id: number,
    input: {
      key?: string;
      name?: string;
      weight?: number;
      metricHint?: string;
    },
    actorUserId: number
  ) {
    return this.prisma.$transaction(async (tx) => {
    const dimension = await tx.performanceDimension.findUnique({
      where: { id },
      include: { cycle: { select: { id: true } } }
    });
    if (!dimension) {
      throw new NotFoundException("绩效维度不存在");
    }

    if (Object.keys(input).length === 0) {
      throw new BadRequestException("更新内容不能为空");
    }

    const data: {
      key?: string;
      name?: string;
      weight?: number;
      metricHint?: string;
    } = {};

      if (Object.prototype.hasOwnProperty.call(input, "key")) {
        const key = input.key?.trim();
        if (!key) {
          throw new BadRequestException("维度Key不能为空");
        }
        if (key.length > 64) {
          throw new BadRequestException("维度Key长度不能超过64个字符");
        }
        if (key !== dimension.key) {
          const duplicate = await tx.performanceDimension.findFirst({
            where: {
              cycleId: dimension.cycleId,
              key,
              id: { not: id }
            },
            select: { id: true }
          });
          if (duplicate) {
            throw new BadRequestException("维度Key已存在");
          }
        }
        data.key = key;
      }

      if (Object.prototype.hasOwnProperty.call(input, "name")) {
        const name = input.name?.trim();
        if (!name) {
          throw new BadRequestException("维度名称不能为空");
        }
        if (name.length > 64) {
          throw new BadRequestException("维度名称长度不能超过64个字符");
        }
        data.name = name;
      }

      if (Object.prototype.hasOwnProperty.call(input, "weight")) {
        const weight = input.weight;
        if (weight === undefined) {
          throw new BadRequestException("权重不能为空");
        }
        if (!Number.isInteger(weight) || weight <= 0 || weight > 100) {
          throw new BadRequestException("权重必须是 1-100 的整数");
        }
        data.weight = weight;
      }

      if (Object.prototype.hasOwnProperty.call(input, "metricHint")) {
        const metricHint = input.metricHint?.trim();
        if (!metricHint) {
          throw new BadRequestException("指标说明不能为空");
        }
        if (metricHint.length > 200) {
          throw new BadRequestException("指标说明长度不能超过200个字符");
        }
        data.metricHint = metricHint;
      }

      if (Object.prototype.hasOwnProperty.call(input, "weight")) {
        const weightSum = await tx.performanceDimension.aggregate({
          where: {
            cycleId: dimension.cycleId,
            id: { not: id }
          },
          _sum: { weight: true }
        });
        const baseSum = weightSum._sum.weight ?? 0;
        const nextWeight = data.weight ?? dimension.weight;
        if (baseSum + nextWeight > 100) {
          throw new BadRequestException("维度权重总和不能超过100");
        }
      }

      const updated = await tx.performanceDimension.update({
        where: { id },
        data
      });

      await this.createAuditLog(tx, {
        actorUserId,
        action: "PERFORMANCE_DIMENSION_UPDATED",
        targetType: "performance_dimension",
        targetId: String(id),
        beforeJson: dimension,
        afterJson: updated
      });

      return updated;
    });
  }

  async deleteDimension(id: number, actorUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const dimension = await tx.performanceDimension.findUnique({
        where: { id },
        select: {
          id: true,
          cycleId: true,
          key: true,
          name: true,
          weight: true,
          metricHint: true
        }
      });
      if (!dimension) {
        throw new NotFoundException("绩效维度不存在");
      }

      await tx.performanceDimension.delete({ where: { id } });

      await this.createAuditLog(tx, {
        actorUserId,
        action: "PERFORMANCE_DIMENSION_DELETED",
        targetType: "performance_dimension",
        targetId: String(id),
        beforeJson: dimension
      });

      return { ...dimension };
    });
  }

  async updateTodo(id: number, input: { done: boolean }) {
    const todo = await this.prisma.performanceTodo.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!todo) {
      throw new NotFoundException("待办不存在");
    }
    return this.prisma.performanceTodo.update({
      where: { id },
      data: { done: input.done }
    });
  }
}
