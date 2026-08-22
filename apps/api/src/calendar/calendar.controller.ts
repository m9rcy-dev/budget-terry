import { Controller, Get, Query } from "@nestjs/common";
import type { CalendarEntry } from "@budget-terry/types";
import { calendarQuerySchema, type CalendarQuery } from "@budget-terry/validation";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessTokenPayload } from "../auth/token.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CalendarService } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("entries")
  entries(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(calendarQuerySchema)) query: CalendarQuery,
  ): Promise<CalendarEntry[]> {
    return this.calendarService.getEntries(user.sub, query);
  }
}
