import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AccessTokenPayload } from "./token.service";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: AccessTokenPayload }>();
    return request.user;
  },
);
