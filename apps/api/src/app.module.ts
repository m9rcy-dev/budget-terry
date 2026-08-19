import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountsModule } from "./accounts/accounts.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { BudgetsModule } from "./budgets/budgets.module";
import { CategoriesModule } from "./categories/categories.module";
import { validateEnv } from "./config/env";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { TransactionsModule } from "./transactions/transactions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    DashboardModule,
    BudgetsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
