import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module";
import { CategoriesModule } from "../categories/categories.module";
import { BillsController } from "./bills.controller";
import { BillsService } from "./bills.service";

@Module({
  imports: [AccountsModule, CategoriesModule],
  controllers: [BillsController],
  providers: [BillsService],
})
export class BillsModule {}
