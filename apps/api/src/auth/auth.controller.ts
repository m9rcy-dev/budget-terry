import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import type { AuthResponse, AuthTokens, AuthenticatedUser } from "@budget-terry/types";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@budget-terry/validation";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { Public } from "./public.decorator";
import type { AccessTokenPayload } from "./token.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<AuthResponse> {
    return this.authService.register(body);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.authService.login(body);
  }

  // Not guarded by JwtAuthGuard — the caller's access token has likely
  // already expired, which is exactly why they're calling this. The
  // refresh token in the body is what authenticates this request.
  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body("refreshToken") refreshToken: string): Promise<AuthTokens> {
    return this.authService.refresh(refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body("refreshToken") refreshToken: string): Promise<void> {
    await this.authService.logout(refreshToken);
  }

  @Get("me")
  me(@CurrentUser() user: AccessTokenPayload): Promise<AuthenticatedUser> {
    return this.authService.getCurrentUser(user.sub);
  }
}
