import { Module } from "@nestjs/common";
import { BillsModule } from "../bills/bills.module";
import { TransactionsModule } from "../transactions/transactions.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [TransactionsModule, BillsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
