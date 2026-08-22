import { Module } from "@nestjs/common";
import { BillsModule } from "../bills/bills.module";
import { GoalsModule } from "../goals/goals.module";
import { TransactionsModule } from "../transactions/transactions.module";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";

@Module({
  imports: [BillsModule, TransactionsModule, GoalsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
