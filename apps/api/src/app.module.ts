import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ImportsModule } from "./modules/imports/imports.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OrgModule } from "./modules/org/org.module";
import { PerformanceModule } from "./modules/performance/performance.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { RolesGuard } from "./modules/common/guards/roles.guard";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    NotificationsModule,
    PerformanceModule,
    OrgModule,
    ImportsModule,
    ReportsModule,
    ReviewsModule
  ],
  controllers: [AppController],
  providers: [RolesGuard]
})
export class AppModule {}
