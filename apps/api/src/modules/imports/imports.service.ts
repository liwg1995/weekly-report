import { Injectable } from "@nestjs/common";
import { ImportStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  createEmployeeImport(input: { fileName: string; operatorUserId?: number }) {
    return this.prisma.importJob.create({
      data: {
        fileName: input.fileName,
        operatorUserId: input.operatorUserId,
        status: ImportStatus.PENDING
      }
    });
  }
}
