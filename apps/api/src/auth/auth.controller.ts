import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
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

// Stricter than the app-wide default (100/min, app.module.ts): login and
// register both run argon2id hashing/verification, which is deliberately
// CPU-expensive — an unthrottled endpoint lets an attacker force that cost
// repeatedly (a resource-exhaustion DoS) even without guessing anything.
// 20/min per IP comfortably covers legitimate retries and the busiest
// integration test file's ~11 rapid registrations, while still cutting an
// automated attacker's throughput by roughly 100x. See plan Section 39.
const AUTH_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("register")
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<AuthResponse> {
    return this.authService.register(body);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.authService.login(body);
  }

  // Not guarded by JwtAuthGuard — the caller's access token has likely
  // already expired, which is exactly why they're calling this. The
  // refresh token in the body is what authenticates this request.
  @Public()
  @Throttle(AUTH_THROTTLE)
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
