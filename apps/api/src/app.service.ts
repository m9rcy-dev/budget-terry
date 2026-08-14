import { Injectable } from "@nestjs/common";

export interface ApiInfo {
  name: string;
  version: string;
}

@Injectable()
export class AppService {
  getInfo(): ApiInfo {
    return { name: "budget-terry-api", version: "0.0.0" };
  }
}
