import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthResponse, AuthTokens, AuthenticatedUser } from "@budget-terry/types";
import {
  deviceLoginSchema,
  loginSchema,
  registerSchema,
  requestLoginCodeSchema,
  verifyLoginCodeSchema,
  type DeviceLoginInput,
  type LoginInput,
  type RegisterInput,
  type RequestLoginCodeInput,
  type VerifyLoginCodeInput,
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

// Tighter than AUTH_THROTTLE: requesting a code has a real external cost
// (an email send) and a real abuse surface (flooding someone else's
// inbox) that login/register don't have.
const REQUEST_CODE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

// Same as AUTH_THROTTLE — verifying a 6-digit code has a much smaller
// keyspace than a password, but the primary defense against brute force
// is AuthService's own per-code attempt lockout (MAX_LOGIN_CODE_ATTEMPTS
// = 5), which is what actually stops guessing *one* issued code. This
// IP-level cap is defense-in-depth on top of that, not a replacement for
// it — an attacker spread across many IPs would evade this alone
// regardless of how tight it is.
const VERIFY_CODE_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

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
  @Throttle(REQUEST_CODE_THROTTLE)
  @Post("login-code/request")
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestLoginCode(
    @Body(new ZodValidationPipe(requestLoginCodeSchema)) body: RequestLoginCodeInput,
  ): Promise<void> {
    await this.authService.requestLoginCode(body.email);
  }

  @Public()
  @Throttle(VERIFY_CODE_THROTTLE)
  @Post("login-code/verify")
  @HttpCode(HttpStatus.OK)
  verifyLoginCode(
    @Body(new ZodValidationPipe(verifyLoginCodeSchema)) body: VerifyLoginCodeInput,
  ): Promise<AuthResponse> {
    return this.authService.verifyLoginCode(body.email, body.code, body.rememberDevice);
  }

  // Not guarded by JwtAuthGuard — same reasoning as /refresh: the device
  // trust token in the body is what authenticates this request, and the
  // caller has no access token yet (that's what this endpoint issues).
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("device-login")
  @HttpCode(HttpStatus.OK)
  deviceLogin(
    @Body(new ZodValidationPipe(deviceLoginSchema)) body: DeviceLoginInput,
  ): Promise<AuthResponse> {
    return this.authService.deviceLogin(body.deviceTrustToken);
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

  @Patch("onboarding")
  completeOnboarding(@CurrentUser() user: AccessTokenPayload): Promise<AuthenticatedUser> {
    return this.authService.completeOnboarding(user.sub);
  }
}
