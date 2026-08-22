import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/public.decorator";
import { AppService, type ApiInfo } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getRoot(): ApiInfo {
    return this.appService.getInfo();
  }
}
