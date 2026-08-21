import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AccountsModule } from "./accounts/accounts.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { BillsModule } from "./bills/bills.module";
import { BudgetsModule } from "./budgets/budgets.module";
import { CalendarModule } from "./calendar/calendar.module";
import { CategoriesModule } from "./categories/categories.module";
import { validateEnv } from "./config/env";
import { DashboardModule } from "./dashboard/dashboard.module";
import { GoalsModule } from "./goals/goals.module";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { TransactionsModule } from "./transactions/transactions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Baseline anti-abuse/DoS limit for every route (plan Section 39: "rate
    // limiting for sensitive endpoints"). Sensitive auth endpoints override
    // this with a stricter limit via @Throttle() — see auth.controller.ts.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    DashboardModule,
    BudgetsModule,
    BillsModule,
    CalendarModule,
    GoalsModule,
    AnalyticsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
