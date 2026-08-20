import { Module } from "@nestjs/common";
import { BillsModule } from "../bills/bills.module";
import { BudgetsModule } from "../budgets/budgets.module";
import { GoalsModule } from "../goals/goals.module";
import { TransactionsModule } from "../transactions/transactions.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [TransactionsModule, BudgetsModule, BillsModule, GoalsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
